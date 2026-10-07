import { NextResponse } from "next/server";
import { requireApiHost } from "@/lib/auth/api-auth";
import { remainingQuota } from "@/lib/rate-limit";
import { AI_COVER_DAILY_LIMIT, AI_COVER_WINDOW_SECONDS } from "@/lib/ai/cover-turn";

export async function GET() {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const remaining = await remainingQuota(`ai-cover:${auth.user.id}`, AI_COVER_DAILY_LIMIT, AI_COVER_WINDOW_SECONDS);
  return NextResponse.json({ remaining });
}
