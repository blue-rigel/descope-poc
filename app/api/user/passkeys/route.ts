import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  getDescopeServer,
  validateDescopeSession,
} from "@/lib/descope-server";

const SESSION_COOKIE = "DS";

/**
 * Resolve the caller's own loginId from their session, so a user can only ever
 * list/remove *their own* passkeys. Returns the loginId or a NextResponse to
 * return early.
 */
async function resolveSelf(request: NextRequest) {
  const jwt = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await validateDescopeSession(jwt);
  if (!session) {
    return {
      loginId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // The session subject is the userId; load the user to get a loginId, which is
  // what the passkey management endpoints expect.
  const userId = session.token.sub;
  if (!userId) {
    return {
      loginId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const res = await getDescopeServer().management.user.loadByUserId(userId);
  const loginId = res.ok ? res.data?.loginIds?.[0] : undefined;
  if (!loginId) {
    return {
      loginId: null,
      error: NextResponse.json(
        { error: "Could not resolve current user" },
        { status: 500 },
      ),
    };
  }
  return { loginId, error: null };
}

/** GET /api/user/passkeys — list the current user's enrolled passkeys. */
export async function GET(request: NextRequest) {
  const { loginId, error } = await resolveSelf(request);
  if (error) return error;

  try {
    const res = await getDescopeServer().management.user.listPasskeys(loginId);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error?.errorMessage ?? "Failed to list passkeys" },
        { status: 502 },
      );
    }
    return NextResponse.json({ passkeys: res.data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/passkeys?credentialId=... — remove one of the current
 * user's passkeys.
 */
export async function DELETE(request: NextRequest) {
  const { loginId, error } = await resolveSelf(request);
  if (error) return error;

  const credentialId = request.nextUrl.searchParams.get("credentialId");
  if (!credentialId) {
    return NextResponse.json(
      { error: "credentialId is required" },
      { status: 400 },
    );
  }

  try {
    const res = await getDescopeServer().management.user.removePasskey(
      loginId,
      credentialId,
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error?.errorMessage ?? "Failed to remove passkey" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
