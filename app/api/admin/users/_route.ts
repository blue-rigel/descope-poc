import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDescopeServer } from "@/lib/descope-server";

/**
 * GET /api/admin/users — list identities via the Descope Management API
 * (`management.user.searchAll`). Runs server-side only, so the management key
 * never reaches the browser.
 *
 * NOTE: this is a PoC demo — the endpoint is intentionally unauthenticated.
 * In production, require a valid session with an "admin" role before calling
 * the management API.
 *
 * Query params:
 *   - limit (default 100)
 *   - page  (default 0)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Number(searchParams.get("limit") ?? 100);
  const page = Number(searchParams.get("page") ?? 0);

  try {
    const res = await getDescopeServer().management.user.searchAll(
      undefined, // tenantIds
      undefined, // roles
      Number.isFinite(limit) ? limit : 100,
      Number.isFinite(page) ? page : 0,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: res.error?.errorMessage ?? "Failed to load users" },
        { status: 502 },
      );
    }

    return NextResponse.json({ users: res.data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic'
