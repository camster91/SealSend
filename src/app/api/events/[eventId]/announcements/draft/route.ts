import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { queryOne } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { aiAnnouncementDraftSchema, type AiAnnouncementDraft } from "@/lib/ai/announcement-draft-schema";
import { createHash } from "node:crypto";

const requestSchema = z.object({
  intent: z.string().trim().min(10).max(1000),
  tone: z.enum(["warm", "professional", "playful", "formal", "casual"]),
  length: z.enum(["short", "standard", "detailed"]),
  urgency: z.enum(["low", "normal", "high"]),
  channel: z.enum(["email", "sms"]),
}).strict();
type RouteParams = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const auth = await requireEventPermission(eventId, "send_messages");
  if (auth.error) return auth.error;
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Describe what guests should know in at least 10 characters." }, { status: 400 });
  const limited = await rateLimit(`ai-announcement:${auth.user.id}`, { max: 20, windowSeconds: 3600 });
  if (!limited.success) return NextResponse.json({ error: "Draft limit reached. Try again later." }, { status: 429 });
  const event = await queryOne<{ title: string; event_date: string | null; event_timezone: string; location_name: string | null }>(
    "SELECT title, event_date, event_timezone, location_name FROM events WHERE id = $1", [eventId],
  );
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let draft: AiAnnouncementDraft;
  let fallback = false;
  let provider = "openai";
  let model = process.env.AI_MODEL || "fallback-v1";
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.AI_MODEL) throw new Error("AI unavailable");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        store: false,
        instructions: "Draft a concise guest announcement. Use only supplied facts. Never invent dates, locations, policies, discounts, guarantees, or emergency claims. Put any ambiguity in cautions. This is a draft requiring human review and approval.",
        input: JSON.stringify({ event, request: parsed.data }),
        text: { format: { type: "json_schema", name: "sealsend_announcement_draft", strict: true, schema: z.toJSONSchema(aiAnnouncementDraftSchema) } },
      }),
    });
    if (!response.ok) throw new Error("AI provider failed");
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new Error("AI provider returned no draft");
    draft = aiAnnouncementDraftSchema.parse(JSON.parse(text));
  } catch {
    fallback = true;
    provider = "deterministic";
    model = "fallback-v1";
    const requestText = parsed.data.channel === "sms" ? parsed.data.intent.slice(0, 240) : parsed.data.intent;
    draft = {
      subject: `Update for ${event.title}`,
      message: parsed.data.channel === "sms" ? `${requestText} Review the event page for details.` : `Hello,\n\n${requestText}\n\nPlease review your event page for the latest details.`,
      cautions: ["This local fallback preserves your wording. Review all facts and add any missing context before approving."],
    };
  }
  const generation = await queryOne<{ id: string }>(
    `INSERT INTO ai_message_generations (user_id,event_id,prompt_hash,provider,model,status,tone,length,urgency,channel)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [auth.user.id, eventId, createHash("sha256").update(parsed.data.intent).digest("hex"), provider, model, fallback ? "fallback" : "completed", parsed.data.tone, parsed.data.length, parsed.data.urgency, parsed.data.channel],
  );
  return NextResponse.json({ generationId: generation?.id, draft, fallback });
}
