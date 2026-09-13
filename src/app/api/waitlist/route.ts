import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Public waitlist capture.
 *
 * Created for issue #149: the pricing page previously showed a disabled
 * "Test billing setup pending" button, which was a dead end for prospective
 * customers. This endpoint lets production capture interest while checkout
 * remains intentionally fail-closed during the controlled beta.
 *
 * No auth required on purpose: the visitor by definition does not have an
 * account yet. Rate limited by IP to avoid abuse.
 */

const waitlistSchema = z
  .object({
    email: z.string().trim().email().max(320),
    plan: z.enum(["pro_annual", "silver", "gold"]).default("pro_annual"),
    source: z.string().trim().max(40).default("pricing"),
  })
  .strict();

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const limited = await rateLimit(`waitlist:${clientIp(request)}`, {
    max: 5,
    windowSeconds: 3600,
  });
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const { email, plan, source } = parsed.data;

  // Idempotent: re-submitting the same email/plan is not an error.
  await query(
    `INSERT INTO waitlist_signups (email, plan_interest, source)
     VALUES ($1, $2, $3)
     ON CONFLICT (LOWER(email), plan_interest) DO NOTHING`,
    [email, plan, source]
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
