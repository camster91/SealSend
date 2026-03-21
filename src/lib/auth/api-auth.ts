import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface AuthenticatedUser {
  id: string;
  email?: string | null;
  role: "admin" | "guest";
  source: "supabase" | "custom";
}

/**
 * Authenticate API requests using either Supabase Auth or custom session.
 * Returns the authenticated user or null if unauthenticated.
 *
 * This bridges the gap between Supabase Auth (used by older flows) and
 * the custom email-code auth system (send-code / verify-code).
 */
export async function getApiUser(): Promise<AuthenticatedUser | null> {
  // 1. Try Supabase Auth first
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return {
        id: user.id,
        email: user.email,
        role: "admin",
        source: "supabase",
      };
    }
  } catch {
    // Supabase auth failed, try custom session
  }

  // 2. Try custom session (sealsend_session cookie)
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("sealsend_session")?.value;

    if (!sessionToken) return null;

    const adminSupabase = createAdminClient();
    const { data: session } = await adminSupabase
      .from("user_sessions")
      .select("user_id, user_role, expires_at")
      .eq("session_token", sessionToken)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!session) return null;

    // Look up email from DB using the validated session's user_id
    let email: string | null = null;
    if (session.user_role === "admin") {
      const { data: adminUser } = await adminSupabase
        .from("admin_users")
        .select("email")
        .eq("id", session.user_id)
        .single();
      email = adminUser?.email || null;
    }

    return {
      id: session.user_id,
      email,
      role: session.user_role as "admin" | "guest",
      source: "custom",
    };
  } catch {
    return null;
  }
}
