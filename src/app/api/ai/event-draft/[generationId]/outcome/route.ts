import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { queryOne } from "@/lib/db/client";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";

const outcomeSchema = z.object({ outcome: z.enum(["accepted", "rejected"]) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await params;
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const parsed = outcomeSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  const result = await queryOne<{ id: string }>(
    `UPDATE ai_generations SET outcome = $1, accepted_at = CASE WHEN $1 = 'accepted' THEN NOW() ELSE NULL END
     WHERE id = $2 AND user_id = $3 AND outcome = 'generated' RETURNING id`,
    [parsed.data.outcome, generationId, auth.user.id],
  );
  if (!result) return NextResponse.json({ error: "Generation not found or already reviewed" }, { status: 404 });
  if (parsed.data.outcome === "accepted") await recordActivationEventSafely({ name: "ai_generation_accepted", userId: auth.user.id, metadata: { aiSchemaVersion: "1.0" } });
  return NextResponse.json({ success: true });
}
