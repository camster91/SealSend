import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { requireEventPermission } from "@/lib/auth/event-api-access";
import { queryOne } from "@/lib/db/client";
import { consumeQuota } from "@/lib/rate-limit";
import { saveImageForUser } from "@/lib/upload-store";
import { coverRequestSchema } from "@/lib/ai/cover-prompt";
import { getCoverImageProvider, isAiCoverConfigured } from "@/lib/ai/image-provider";
import {
  AI_COVER_DAILY_LIMIT,
  AI_COVER_TIMEOUT_MS,
  AI_COVER_UNAVAILABLE_RESPONSE,
  AI_COVER_WINDOW_SECONDS,
  getCoverEventId,
  runCoverTurn,
} from "@/lib/ai/cover-turn";

export async function POST(request: Request) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const eventId = getCoverEventId(json);
  if (!eventId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const access = await requireEventPermission(eventId, "edit_event");
  if (access.error) return access.error;

  if (!isAiCoverConfigured()) {
    return NextResponse.json(AI_COVER_UNAVAILABLE_RESPONSE.json, { status: AI_COVER_UNAVAILABLE_RESPONSE.status });
  }

  const parsed = coverRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const event = await queryOne<{ title: string; description: string | null }>(
    "SELECT title, description FROM events WHERE id = $1",
    [eventId],
  );
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await runCoverTurn(
    {
      provider: getCoverImageProvider(),
      consume: () =>
        consumeQuota(`ai-cover:${auth.user.id}`, 1, {
          max: AI_COVER_DAILY_LIMIT,
          windowSeconds: AI_COVER_WINDOW_SECONDS,
        }),
      save: (bytes) =>
        saveImageForUser(auth.user.id, bytes, {
          mediaType: "image",
          originalName: "ai-cover.png",
          contentType: "image/png",
        }),
      timeoutMs: AI_COVER_TIMEOUT_MS,
    },
    { title: event.title, description: event.description, style: parsed.data.style, note: parsed.data.note },
  );
  return NextResponse.json(result.json, { status: result.status });
}
