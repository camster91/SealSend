import { buildChatInstructions } from "@/lib/ai/chat-prompt";
import { sanitizeChatTurn, type ChatRequest } from "@/lib/ai/chat-schema";
import type { ChatProvider } from "@/lib/ai/provider";

export const AI_CHAT_DAILY_LIMIT = 40;
export const AI_CHAT_WINDOW_SECONDS = 86400;
export const AI_CHAT_TIMEOUT_MS = 20_000;

const LIMIT_COPY = "You've used today's AI help. Keep going in manual mode — everything you've filled in is saved.";
const FAILED_COPY = "The assistant is having trouble right now.";

export const AI_FAILED_RESPONSE = { status: 502, json: { error: FAILED_COPY, code: "AI_FAILED" } };

export async function runChatTurn(
  deps: {
    provider: ChatProvider;
    consume: (units: number) => Promise<{ success: boolean }>;
    timeoutMs: number;
  },
  body: ChatRequest,
): Promise<{ status: number; json: unknown }> {
  const quota = await deps.consume(1);
  if (!quota.success) return { status: 429, json: { error: LIMIT_COPY, code: "AI_CHAT_LIMIT" } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const result = await deps.provider.respond({
      instructions: buildChatInstructions({ today: body.today, timezone: body.timezone, data: body.data }),
      messages: body.messages,
      signal: controller.signal,
    });
    const turn = sanitizeChatTurn(result.raw);
    if (!turn) return AI_FAILED_RESPONSE;
    return { status: 200, json: turn };
  } catch {
    // Deliberately drops the error: it may carry conversation text.
    return AI_FAILED_RESPONSE;
  } finally {
    clearTimeout(timer);
  }
}
