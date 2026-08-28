import { NextResponse } from "next/server";

import { requireApiHost } from "@/lib/auth/api-auth";
import { parseBetaOutcome, type BetaWillingnessToPay } from "@/lib/beta-outcome";
import { BETA_SEGMENTS, type BetaSegment } from "@/lib/beta-participation";
import { getDb, queryOne } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";

interface OutcomeRow {
  willingness_to_pay: BetaWillingnessToPay;
  repeat_intent: number;
  self_reported_support_minutes: number;
  price_version: string;
  updated_at: string;
}

const noStore = (body: unknown, init?: { status?: number }) => NextResponse.json(body, {
  ...init,
  headers: { "Cache-Control": "no-store" },
});

function publicOutcome(row: OutcomeRow | null) {
  return row ? {
    willingnessToPay: row.willingness_to_pay,
    repeatIntent: row.repeat_intent,
    selfReportedSupportMinutes: row.self_reported_support_minutes,
    priceVersion: row.price_version,
    updatedAt: row.updated_at,
  } : null;
}

async function getCurrentOutcome(userId: string) {
  return queryOne<OutcomeRow>(
    `SELECT outcomes.willingness_to_pay, outcomes.repeat_intent,
            outcomes.self_reported_support_minutes, outcomes.price_version, outcomes.updated_at
       FROM beta_participants participants
       JOIN beta_outcomes outcomes
         ON outcomes.user_id = participants.user_id
        AND outcomes.consented_at = participants.consented_at
      WHERE participants.user_id = $1
        AND participants.withdrawn_at IS NULL
        AND participants.segment = ANY($2::text[])`,
    [userId, BETA_SEGMENTS],
  );
}

export async function GET() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  return noStore({ outcome: publicOutcome(await getCurrentOutcome(auth.user.id)) });
}

export async function POST(httpRequest: Request) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const limited = await rateLimit(`beta-outcome:${auth.user.id}`, { max: 10, windowSeconds: 86400 });
  if (!limited.success) return noStore({ error: "Outcome update limit reached for today." }, { status: 429 });

  let outcome;
  try {
    outcome = parseBetaOutcome(await httpRequest.json());
  } catch {
    return noStore({ error: "Complete each outcome question with a valid selection." }, { status: 400 });
  }

  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const participantResult = await client.query<{ consented_at: string; consent_version: string; segment: BetaSegment }>(
      `SELECT consented_at, consent_version, segment
         FROM beta_participants
        WHERE user_id = $1
          AND withdrawn_at IS NULL
          AND segment = ANY($2::text[])
        FOR UPDATE`,
      [auth.user.id, BETA_SEGMENTS],
    );
    const participant = participantResult.rows[0];
    if (!participant) {
      await client.query("ROLLBACK");
      return noStore({ error: "Active controlled-beta consent is required." }, { status: 403 });
    }
    await client.query(
      `INSERT INTO beta_outcomes
         (user_id, consented_at, consent_version, willingness_to_pay, repeat_intent,
          self_reported_support_minutes, price_version, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (user_id, consented_at) DO UPDATE SET
         willingness_to_pay = EXCLUDED.willingness_to_pay,
         repeat_intent = EXCLUDED.repeat_intent,
         self_reported_support_minutes = EXCLUDED.self_reported_support_minutes,
         price_version = EXCLUDED.price_version,
         updated_at = NOW()`,
      [auth.user.id, participant.consented_at, participant.consent_version, outcome.willingnessToPay,
        outcome.repeatIntent, outcome.selfReportedSupportMinutes, outcome.priceVersion],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return noStore({ outcome: publicOutcome(await getCurrentOutcome(auth.user.id)) }, { status: 201 });
}
