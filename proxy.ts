import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { validateDescopeSession } from "@/lib/descope-server";
import { POST_LOGIN_PATH } from "@/lib/descope-config";

/** Descope's default session-token cookie name. */
const SESSION_COOKIE = "DS";

/** Routes that require an authenticated session. */
const PROTECTED = ["/me", "/auth/settings", "/sessions", "/sensitive"];

/** Routes an already-authenticated user should be bounced away from. */
const AUTH_ONLY = ["/auth/login", "/login-native", "/login-otp"];

/**
 * Next.js 16 "proxy" (formerly middleware). Runs on the Node.js runtime so we
 * can validate the session with @descope/node-sdk directly.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionJwt = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await validateDescopeSession(sessionJwt);
  const isAuthed = Boolean(session);

  // Logged-in users shouldn't sit on the native login page.
  if (isAuthed && AUTH_ONLY.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL(POST_LOGIN_PATH, request.url));
  }

  // Logged-out users can't reach protected routes.
  if (!isAuthed && PROTECTED.some((p) => pathname.startsWith(p))) {
    // Proxy cannot see a DSR stored in localStorage. Always let the browser SDK
    // attempt restoration before deciding that the user must sign in again.
    const destination = `${pathname}${request.nextUrl.search}`;
    const url = new URL("/auth/refresh", request.url);
    url.searchParams.set("from", destination);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/me/:path*",
    "/auth/settings/:path*",
    "/sessions/:path*",
    "/sensitive/:path*",
    "/auth/login/:path*",
    "/login-native/:path*",
    "/login-otp/:path*",
  ],
};
