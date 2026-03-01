import { createAdminClient } from "@/lib/supabase/admin";
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

  const adminSupabase = createAdminClient();

  // Find the guest by invite token
  const { data: guest, error: guestError } = await adminSupabase
    .from("guests")
    .select("id, name, email, phone, event_id, invite_token")
    .eq("invite_token", token)
    .single();

  if (guestError || !guest) {
    console.error("Invalid invite token:", guestError);
    redirect("/login?error=invalid_invite");
  }

  // Verify the event slug matches
  const { data: event, error: eventError } = await adminSupabase
    .from("events")
    .select("id, slug")
    .eq("id", guest.event_id)
    .single();

  if (eventError || !event || event.slug !== eventSlug) {
    console.error("Event mismatch:", eventError);
    redirect("/login?error=invalid_invite");
  }

  // Create a session for this guest
  const sessionToken = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  // Create user session
  const { error: sessionError } = await adminSupabase
    .from("user_sessions")
    .insert({
      user_id: guest.id,
      session_token: sessionToken,
      user_role: "guest",
      expires_at: expiresAt.toISOString(),
    });

  if (sessionError) {
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
      id: guest.id,
      email: guest.email,
      phone: guest.phone,
      role: "guest",
      eventId: guest.event_id,
      name: guest.name,
    }),
    {
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    }
  );

  // Update guest's invite status to accepted
  await adminSupabase
    .from("guests")
    .update({ 
      invite_status: "accepted"
    })
    .eq("id", guest.id);

  // Redirect to the event page
  redirect(`/events/${guest.event_id}/guest`);
}
