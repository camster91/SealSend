import { randomBytes } from "node:crypto";
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
import { query, queryOne } from "@/lib/db/client";

interface ParticipantRow {
  participant_label: string;
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
    `SELECT participant_label, segment, consent_version, consented_at, withdrawn_at
     FROM beta_participants WHERE user_id = $1`,
    [userId],
  );
  if (!participant) return { participant: null, progress: null };

  const [events, feedback] = await Promise.all([
    query<{ event_name: BetaMilestoneName; created_at: string }>(
      `SELECT event_name, created_at FROM activation_events
       WHERE user_id = $1 AND created_at >= $2 AND event_name = ANY($3::text[])
       ORDER BY created_at ASC`,
      [userId, participant.consented_at, BETA_MILESTONE_NAMES],
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM beta_feedback
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
  let enrollment;
  try {
    enrollment = parseBetaEnrollment(await request.json());
  } catch {
    return noStore({ error: "Choose a beta segment and explicitly consent to observation." }, { status: 400 });
  }

  const participantLabel = `host-${randomBytes(6).toString("hex")}`;
  await queryOne(
    `INSERT INTO beta_participants
       (user_id, participant_label, segment, consent_version, consented_at, withdrawn_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NULL, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       segment = EXCLUDED.segment,
       consent_version = EXCLUDED.consent_version,
       consented_at = NOW(),
       withdrawn_at = NULL,
       updated_at = NOW()
     RETURNING participant_label`,
    [auth.user.id, participantLabel, enrollment.segment, enrollment.consentVersion],
  );
  return noStore(await getParticipation(auth.user.id), { status: 201 });
}

export async function DELETE() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const participant = await queryOne<{ participant_label: string }>(
    `UPDATE beta_participants SET withdrawn_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND withdrawn_at IS NULL
     RETURNING participant_label`,
    [auth.user.id],
  );
  if (!participant) return noStore({ error: "No active beta consent was found." }, { status: 404 });
  return noStore(await getParticipation(auth.user.id));
}
