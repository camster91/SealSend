import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { queryOne } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { getUserTier } from "@/lib/subscription";
import { getEventDraftProvider } from "@/lib/ai/provider";
import { buildFallbackEventDraft } from "@/lib/ai/fallback";
import { parseAiEventDraft, AI_EVENT_DRAFT_SCHEMA_VERSION, type AiEventDraft } from "@/lib/ai/event-draft-schema";
import { recordActivationEventSafely } from "@/lib/analytics/activation-events";

const requestSchema = z.object({
  prompt: z.string().trim().min(20).max(2000),
  timezone: z.string().min(1).max(100).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }),
}).strict();

export async function POST(request: Request) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Describe the event in at least 20 characters and provide a valid timezone." }, { status: 400 });
  const { success } = await rateLimit(`ai-event-draft:${auth.user.id}`, { max: 10, windowSeconds: 3600 });
  if (!success) return NextResponse.json({ error: "AI generation limit reached. Try again later." }, { status: 429 });
  const plan = await getUserTier(auth.user.id);
  const dailyLimit = plan === "pro_annual" ? 50 : 5;
  const usage = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM ai_generations WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'", [auth.user.id],
  );
  if (Number(usage?.count ?? 0) >= dailyLimit) return NextResponse.json({ error: `Daily AI draft limit reached (${dailyLimit}).` }, { status: 429 });
  await recordActivationEventSafely({ name: "ai_generation_started", userId: auth.user.id, metadata: { aiSchemaVersion: AI_EVENT_DRAFT_SCHEMA_VERSION } });
  const started = Date.now();
  let provider = "deterministic";
  let model = "fallback-v1";
  let status: "completed" | "fallback" = "completed";
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let estimatedCostMicros: number | null = null;
  let draft: AiEventDraft;
  try {
    const generated = await getEventDraftProvider().generate(parsed.data.prompt, parsed.data.timezone, AbortSignal.timeout(20_000));
    draft = parseAiEventDraft(generated.draft);
    provider = generated.provider; model = generated.model; inputTokens = generated.inputTokens; outputTokens = generated.outputTokens; estimatedCostMicros = generated.estimatedCostMicros;
  } catch {
    draft = parseAiEventDraft(buildFallbackEventDraft(parsed.data.prompt, parsed.data.timezone));
    status = "fallback";
  }
  const generation = await queryOne<{ id: string }>(
    `INSERT INTO ai_generations
      (user_id, prompt_hash, provider, model, schema_version, status, latency_ms, input_tokens, output_tokens, estimated_cost_micros)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [auth.user.id, createHash("sha256").update(parsed.data.prompt).digest("hex"), provider, model, AI_EVENT_DRAFT_SCHEMA_VERSION, status, Date.now() - started, inputTokens, outputTokens, estimatedCostMicros],
  );
  if (!generation) return NextResponse.json({ error: "Could not record AI draft" }, { status: 500 });
  await recordActivationEventSafely({ name: "ai_generation_completed", userId: auth.user.id, metadata: { aiSchemaVersion: AI_EVENT_DRAFT_SCHEMA_VERSION, model, status } });
  return NextResponse.json({ generationId: generation.id, draft, fallback: status === "fallback" });
}
