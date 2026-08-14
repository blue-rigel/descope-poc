import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getDescopeServer } from "@/lib/descope-server";

/**
 * NOTE: this is a PoC demo — these endpoints are intentionally unauthenticated.
 * In production, require a valid session with an "admin" role before calling
 * the management API.
 */

/** In Next 16, dynamic route params are async. */
type Ctx = { params: Promise<{ loginId: string }> };

/**
 * GET /api/admin/users/:loginId — full details for one identity
 * (`management.user.load`). The client encodes the loginId (which may contain
 * `@`), so we decode it here.
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { loginId } = await ctx.params;
  const decoded = decodeURIComponent(loginId);

  try {
    const res = await getDescopeServer().management.user.load(decoded);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error?.errorMessage ?? "User not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ user: res.data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/users/:loginId — change status.
 * Body: { action: "activate" | "deactivate" }
 * Maps to `management.user.activate` / `management.user.deactivate`.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { loginId } = await ctx.params;
  const decoded = decodeURIComponent(loginId);

  let action: string;
  try {
    ({ action } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (action !== "activate" && action !== "deactivate") {
    return NextResponse.json(
      { error: "action must be 'activate' or 'deactivate'" },
      { status: 400 },
    );
  }

  try {
    const mgmt = getDescopeServer().management.user;
    const res =
      action === "activate"
        ? await mgmt.activate(decoded)
        : await mgmt.deactivate(decoded);

    if (!res.ok) {
      return NextResponse.json(
        { error: res.error?.errorMessage ?? "Status update failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ user: res.data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/users/:loginId — permanently delete an identity
 * (`management.user.delete`).
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { loginId } = await ctx.params;
  const decoded = decodeURIComponent(loginId);

  try {
    const res = await getDescopeServer().management.user.delete(decoded);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error?.errorMessage ?? "Delete failed" },
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
