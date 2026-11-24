import { NextResponse } from "next/server";
import {
  BETA_MILESTONE_NAMES,
  deriveBetaProgress,
  isBetaParticipationActive,
  parseBetaEnrollment,
  type BetaMilestoneName,
  type BetaSegment,
} from "@/lib/beta-participation";
import { requireApiHost } from "@/lib/auth/api-auth";
import { batch, query, queryOne } from "@/lib/db/client";
import { SQL_NOW, abortCode, guard } from "@/lib/db/sqlite-dialect";
import { hashMagicToken } from "@/lib/magic-token";
import betaAcceptancePolicy from "../../../../../config/beta-acceptance-policy.json";

interface ParticipantRow {
  participant_label: string;
  cohort_version: string;
  segment: BetaSegment;
  consent_version: string;
  consented_at: string;
  withdrawn_at: string | null;
}

const noStore = (body: unknown, init?: { status?: number }) => NextResponse.json(body, {
  ...init,
  headers: { "Cache-Control": "no-store" },
});

async function getParticipation(userId: string) {
  const participant = await queryOne<ParticipantRow>(
    `SELECT participant_label, cohort_version, segment, consent_version, consented_at, withdrawn_at
     FROM beta_participants WHERE user_id = $1 AND cohort_version = $2`,
    [userId, betaAcceptancePolicy.cohortVersion],
  );
  if (!participant) return { participant: null, progress: null };

  const [events, feedback] = await Promise.all([
    query<{ event_name: BetaMilestoneName; created_at: string }>(
      `SELECT event_name, created_at FROM activation_events
       WHERE user_id = $1 AND created_at >= $2 AND event_name IN (SELECT value FROM json_each($3))
       ORDER BY created_at ASC`,
      [userId, participant.consented_at, BETA_MILESTONE_NAMES],
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM beta_feedback
       WHERE user_id = $1 AND created_at >= $2`,
      [userId, participant.consented_at],
    ),
  ]);
  const progress = deriveBetaProgress({
    consentedAt: participant.consented_at,
    activationEvents: events.map((event) => ({ name: event.event_name, createdAt: event.created_at })),
    feedbackCount: Number(feedback?.count ?? 0),
  });
  return {
    participant: {
      label: participant.participant_label,
      cohortVersion: participant.cohort_version,
      segment: participant.segment,
      consentVersion: participant.consent_version,
      consentedAt: participant.consented_at,
      withdrawnAt: participant.withdrawn_at,
      active: isBetaParticipationActive({
        consentedAt: participant.consented_at,
        withdrawnAt: participant.withdrawn_at,
      }),
    },
    progress,
  };
}

export async function GET() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  return noStore(await getParticipation(auth.user.id));
}

export async function POST(request: Request) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  if (betaAcceptancePolicy.status !== "approved") {
    return noStore({ error: "Beta enrollment is not open until the cohort policy is approved." }, { status: 409 });
  }
  let enrollment;
  try {
    enrollment = parseBetaEnrollment(await request.json());
  } catch {
    return noStore({ error: "Enter a valid invitation code and explicitly consent to observation." }, { status: 400 });
  }

  const invite = await queryOne<{
    id: string;
    participant_label: string;
    cohort_version: string;
    segment: BetaSegment;
  }>(
    `SELECT id, participant_label, cohort_version, segment
       FROM beta_enrollment_invites
      WHERE token_hash = $1
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > ${SQL_NOW}
        AND cohort_version = $2`,
    [hashMagicToken(enrollment.inviteToken), betaAcceptancePolicy.cohortVersion],
  );
  if (!invite) return noStore({ error: "Invitation code is invalid, expired, revoked, or already used." }, { status: 404 });

  try {
    // One-time invite: the guard re-checks it inside the batch, so a parallel enrollment loses.
    // Cohort/segment uniqueness stays with the unique indexes on beta_participants.
    await batch([
      guard(
        `EXISTS (SELECT 1 FROM beta_enrollment_invites
                 WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ${SQL_NOW} AND cohort_version = $2)`,
        [invite.id, betaAcceptancePolicy.cohortVersion],
        "invite_used",
      ),
      {
        text: `INSERT INTO beta_participants
                 (user_id, participant_label, segment, cohort_version, consent_version, consented_at, withdrawn_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, ${SQL_NOW}, NULL, ${SQL_NOW})
               ON CONFLICT (user_id) DO UPDATE SET
                 participant_label = excluded.participant_label,
                 segment = excluded.segment,
                 cohort_version = excluded.cohort_version,
                 consent_version = excluded.consent_version,
                 consented_at = ${SQL_NOW},
                 withdrawn_at = NULL,
                 updated_at = ${SQL_NOW}`,
        params: [auth.user.id, invite.participant_label, invite.segment, invite.cohort_version, enrollment.consentVersion],
      },
      {
        text: `UPDATE beta_enrollment_invites
                  SET accepted_by = $2, accepted_at = ${SQL_NOW}
                WHERE id = $1 AND accepted_at IS NULL`,
        params: [invite.id, auth.user.id],
      },
    ]);
  } catch (error) {
    if (abortCode(error) === "invite_used") return noStore({ error: "Invitation code is invalid, expired, revoked, or already used." }, { status: 404 });
    throw error;
  }
  return noStore(await getParticipation(auth.user.id), { status: 201 });
}

export async function DELETE() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const participant = await queryOne<{ participant_label: string }>(
    `UPDATE beta_participants SET withdrawn_at = ${SQL_NOW}, updated_at = ${SQL_NOW}
     WHERE user_id = $1 AND withdrawn_at IS NULL
     RETURNING participant_label`,
    [auth.user.id],
  );
  if (!participant) return noStore({ error: "No active beta consent was found." }, { status: 404 });
  return noStore(await getParticipation(auth.user.id));
}
