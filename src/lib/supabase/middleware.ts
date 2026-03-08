import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseUser = null;
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, {
                ...options,
                maxAge: 60 * 60 * 24 * 30,
              })
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    supabaseUser = user;
  }

  const { pathname } = request.nextUrl;

  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/callback",
    "/how-it-works",
    "/pricing",
    "/use-cases",
  ];

  const isPublicRoute =
    publicPaths.some((path) => pathname === path || pathname.startsWith(path + "/")) ||
    pathname.startsWith("/e/") ||
    pathname.startsWith("/api/") ||
    /^\/events\/[^\/]+\/(guest|public)$/.test(pathname);

  const isAuthenticated = !!supabaseUser;

  if (!isPublicRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const authPaths = ["/login", "/signup", "/forgot-password"];
  const isAuthRoute = authPaths.some((path) => pathname === path);

  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
