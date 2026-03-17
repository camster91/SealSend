import { prisma } from "@/lib/db";
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
  const guest = await prisma.guest.findFirst({
    where: { invite_token: token },
    select: { id: true, name: true, email: true, phone: true, event_id: true, invite_token: true },
  });

  if (!guest) {
    console.error("Invalid invite token");
    redirect("/login?error=invalid_invite");
  }

  // Verify the event slug matches
  const event = await prisma.event.findUnique({
    where: { id: guest.event_id },
    select: { id: true, slug: true },
  });

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
    await prisma.userSession.create({
      data: {
        user_id: guest.id,
        session_token: sessionToken,
        user_role: "guest",
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error("Failed to create session:", err);
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
  await prisma.guest.update({
    where: { id: guest.id },
    data: { invite_status: "accepted" },
  });

  // Redirect to the event page
  redirect(`/events/${guest.event_id}/guest`);
}
