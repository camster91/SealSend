import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { consumeQuota } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/lib/ai/chat-schema";
import { getChatProvider, isAiChatConfigured } from "@/lib/ai/provider";
import {
  AI_CHAT_DAILY_LIMIT,
  AI_CHAT_TIMEOUT_MS,
  AI_CHAT_WINDOW_SECONDS,
  AI_UNAVAILABLE_RESPONSE,
  getChatEventId,
  runChatTurn,
} from "@/lib/ai/chat-turn";

export async function POST(request: Request) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const eventId = getChatEventId(json);
  if (eventId) {
    const access = await requireEventPermission(eventId, "edit_event");
    if (access.error) return access.error;
  }

  if (!isAiChatConfigured()) {
    return NextResponse.json(AI_UNAVAILABLE_RESPONSE.json, { status: AI_UNAVAILABLE_RESPONSE.status });
  }

  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await runChatTurn(
    {
      provider: getChatProvider(),
      consume: (units) =>
        consumeQuota(`ai-chat:${auth.user.id}`, units, {
          max: AI_CHAT_DAILY_LIMIT,
          windowSeconds: AI_CHAT_WINDOW_SECONDS,
        }),
      timeoutMs: AI_CHAT_TIMEOUT_MS,
    },
    parsed.data,
  );
  return NextResponse.json(result.json, { status: result.status });
}
