import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHost } from "@/lib/auth/api-auth";
import { query } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";

const feedbackSchema = z.object({
  category: z.enum(["setup", "ai_draft", "guest_management", "communications", "check_in", "other"]),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(5).max(2000),
  mayContact: z.boolean(),
}).strict();

export async function POST(request: Request) {
  const auth = await requireApiHost();
  if (auth.error) return auth.error;
  const limited = await rateLimit(`feedback:${auth.user.id}`, { max: 5, windowSeconds: 86400 });
  if (!limited.success) return NextResponse.json({ error: "Feedback limit reached for today." }, { status: 429 });
  const parsed = feedbackSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Choose a rating and share at least five characters." }, { status: 400 });
  await query(
    `INSERT INTO beta_feedback (user_id, category, rating, message, may_contact)
     VALUES ($1,$2,$3,$4,$5)`,
    [auth.user.id, parsed.data.category, parsed.data.rating, parsed.data.message, parsed.data.mayContact],
  );
  return NextResponse.json({ success: true }, { status: 201 });
}
