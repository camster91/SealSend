import { query, queryOne } from "@/lib/db/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";

interface AcceptInvitePageProps {
  searchParams: Promise<{
    token?: string;
    event?: string;
  }>;
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const params = await searchParams;
  const token = params.token;
  const eventSlug = params.event;

  if (!token || !eventSlug) {
    redirect("/login?error=invalid_invite");
  }

  // Find the guest by invite token
  const guest = await queryOne<{ id: string; name: string; email: string | null; phone: string | null; event_id: string; invite_token: string }>(
    'SELECT id, name, email, phone, event_id, invite_token FROM guests WHERE invite_token = $1',
    [token]
  );

  if (!guest) {
    console.error("Invalid invite token");
    redirect("/login?error=invalid_invite");
  }

  // Verify the event slug matches
  const event = await queryOne<{ id: string; slug: string }>(
    'SELECT id, slug FROM events WHERE id = $1',
    [guest.event_id]
  );

  if (!event || event.slug !== eventSlug) {
    console.error("Event mismatch");
    redirect("/login?error=invalid_invite");
  }

  // Create a session for this guest
  const sessionToken = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  // Create user session
  try {
    await query(
      'INSERT INTO user_sessions (user_id, session_token, user_role, expires_at) VALUES ($1, $2, $3, $4)',
      [guest.id, sessionToken, 'guest', expiresAt.toISOString()]
    );
  } catch (sessionError) {
    console.error("Failed to create session:", sessionError);
    redirect("/login?error=session_failed");
  }

  // Set cookies
  const cookieStore = await cookies();

  cookieStore.set("sealsend_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  cookieStore.set(
    "sealsend_user",
    JSON.stringify({
      email: guest.email,
      phone: guest.phone,
      role: "guest",
      eventId: guest.event_id,
      name: guest.name,
    }),
    {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    }
  );

  // Update guest's invite status to accepted
  await query(
    'UPDATE guests SET invite_status = $1 WHERE id = $2',
    ['accepted', guest.id]
  );

  // Redirect to the event page
  redirect(`/events/${guest.event_id}/guest`);
}
