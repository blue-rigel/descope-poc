"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  ShieldOff,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Mirror of Descope's UserResponse (only the fields we render). */
type DescopeUser = {
  userId: string;
  loginIds: string[];
  email?: string;
  phone?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  status: string; // "enabled" | "disabled" | "invited"
  verifiedEmail?: boolean;
  verifiedPhone?: boolean;
  roleNames?: string[];
  userTenants?: { tenantId: string; tenantName: string; roleNames?: string[] }[];
  createdTime: number;
  TOTP?: boolean;
  SAML?: boolean;
  password?: boolean;
  OAuth?: Record<string, boolean>;
  customAttributes?: Record<string, unknown>;
  test?: boolean;
};

const primaryLoginId = (u: DescopeUser) => u.loginIds?.[0] ?? u.userId;

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    enabled: "bg-emerald-100 text-emerald-700",
    disabled: "bg-rose-100 text-rose-700",
    invited: "bg-amber-100 text-amber-700",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function AdminIdentitiesPage() {
  const [users, setUsers] = useState<DescopeUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DescopeUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users?limit=100", {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to load identities");
        return;
      }
      const list = (body.users ?? []) as DescopeUser[];
      list.sort((a, b) => b.createdTime - a.createdTime);
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.phone, ...(u.loginIds ?? []), u.userId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [users, query]);

  const viewDetails = async (u: DescopeUser) => {
    setDetail(u); // optimistic: show the row data immediately
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(primaryLoginId(u))}`,
        { cache: "no-store" },
      );
      const body = await res.json();
      if (res.ok && body.user) setDetail(body.user as DescopeUser);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleStatus = async (u: DescopeUser) => {
    const action = u.status === "disabled" ? "activate" : "deactivate";
    setBusyId(u.userId);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(primaryLoginId(u))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Status update failed");
        return;
      }
      const updated = body.user as DescopeUser;
      setUsers((prev) =>
        prev
          ? prev.map((x) => (x.userId === updated.userId ? updated : x))
          : prev,
      );
      if (detail?.userId === updated.userId) setDetail(updated);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (u: DescopeUser) => {
    if (
      !window.confirm(
        `Permanently delete "${primaryLoginId(u)}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(u.userId);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(primaryLoginId(u))}`,
        { method: "DELETE" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Delete failed");
        return;
      }
      setUsers((prev) => prev?.filter((x) => x.userId !== u.userId) ?? prev);
      if (detail?.userId === u.userId) setDetail(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin: Identities</h1>
          <p className="text-sm text-muted-foreground">
            Users from the Descope Management API. List, inspect, enable/disable,
            and delete.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, or login ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Loading identities…</p>
      )}

      {!loading && users && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {users.length === 0 ? "No users found." : "No matches."}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((u) => {
          const busy = busyId === u.userId;
          return (
            <Card key={u.userId}>
              <CardContent className="flex items-center gap-4 py-3">
                <Avatar user={u} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {u.name || primaryLoginId(u)}
                    </span>
                    <StatusPill status={u.status} />
                    {u.test && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                        test
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {u.email || primaryLoginId(u)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void viewDetails(u)}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => void toggleStatus(u)}
                  >
                    {u.status === "disabled" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Enable
                      </>
                    ) : (
                      <>
                        <ShieldOff className="h-4 w-4 text-amber-600" />
                        Disable
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => void remove(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {detail && (
        <UserDetailModal
          user={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}

function Avatar({ user }: { user: DescopeUser }) {
  if (user.picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.picture}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <UserRound className="h-5 w-5" />
    </div>
  );
}

function UserDetailModal({
  user,
  loading,
  onClose,
}: {
  user: DescopeUser;
  loading: boolean;
  onClose: () => void;
}) {
  const authMethods = [
    user.password && "Password",
    user.TOTP && "TOTP",
    user.SAML && "SAML",
    ...Object.entries(user.OAuth ?? {})
      .filter(([, v]) => v)
      .map(([k]) => `OAuth: ${k}`),
  ].filter(Boolean) as string[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="space-y-4 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar user={user} />
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  {user.name || primaryLoginId(user)}
                  <StatusPill status={user.status} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {user.email || primaryLoginId(user)}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {loading && (
            <p className="text-xs text-muted-foreground">Loading full record…</p>
          )}

          <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
            <Field label="User ID" value={user.userId} mono />
            <Field label="Login IDs" value={user.loginIds?.join(", ")} />
            <Field label="Email" value={user.email} />
            <Field
              label="Email verified"
              value={user.email ? String(!!user.verifiedEmail) : undefined}
            />
            <Field label="Phone" value={user.phone} />
            <Field
              label="Phone verified"
              value={user.phone ? String(!!user.verifiedPhone) : undefined}
            />
            <Field
              label="Created"
              value={
                user.createdTime
                  ? new Date(user.createdTime * 1000).toLocaleString()
                  : undefined
              }
            />
            <Field
              label="Roles"
              value={user.roleNames?.length ? user.roleNames.join(", ") : "—"}
            />
            <Field
              label="Auth methods"
              value={authMethods.length ? authMethods.join(", ") : "—"}
            />
          </dl>

          {user.userTenants && user.userTenants.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Tenants
              </div>
              <ul className="space-y-1 text-sm">
                {user.userTenants.map((t) => (
                  <li key={t.tenantId}>
                    {t.tenantName}
                    {t.roleNames?.length ? ` — ${t.roleNames.join(", ")}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {user.customAttributes &&
            Object.keys(user.customAttributes).length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                  Custom attributes
                </div>
                <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(user.customAttributes, null, 2)}
                </pre>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="col-span-3 grid grid-cols-3 gap-3 sm:col-span-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`col-span-2 break-words ${mono ? "font-mono text-xs" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
