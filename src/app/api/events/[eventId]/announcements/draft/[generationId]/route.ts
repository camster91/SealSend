import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { queryOne } from "@/lib/db/client";

const schema = z.object({ outcome: z.enum(["accepted", "rejected"]).optional(), helpful: z.boolean().optional() }).strict().refine((value) => value.outcome !== undefined || value.helpful !== undefined);
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string; generationId: string }> }) {
  const { eventId, generationId } = await params;
  const auth = await requireEventPermission(eventId, "send_messages");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  const updated = await queryOne(
    `UPDATE ai_message_generations SET
       outcome = COALESCE($4, outcome), helpful = COALESCE($5, helpful),
       accepted_at = CASE WHEN $4 = 'accepted' THEN NOW() ELSE accepted_at END
     WHERE id = $1 AND event_id = $2 AND user_id = $3 RETURNING id`,
    [generationId, eventId, auth.user.id, parsed.data.outcome ?? null, parsed.data.helpful ?? null],
  );
  return updated ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Draft not found" }, { status: 404 });
}
