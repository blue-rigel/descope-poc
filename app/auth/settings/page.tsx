"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Fingerprint,
  KeyRound,
  LogOut,
  ShieldCheck,
  ShieldOff,
  User as UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDescope, getToken } from "@/lib/descope-client";
import { LOGIN_PATH } from "@/lib/descope-config";
import { cn } from "@/lib/utils";

type MeUser = Awaited<
  ReturnType<ReturnType<typeof getDescope>["me"]>
>["data"];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDescope().me();
      if (!res.ok) {
        setError(res.error?.errorMessage ?? "Could not load profile");
        return;
      }
      setUser(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const logout = async () => {
    try {
      await getDescope().logout();
    } finally {
      router.push(LOGIN_PATH);
      router.refresh();
    }
  };

  const loginId = user?.loginIds?.[0] ?? "";

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and multi-factor authentication.
          </p>
        </div>
        <Button variant="outline" onClick={logout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {user && (
        <>
          <ProfileCard user={user} />
          <TotpCard loginId={loginId} enrolled={user.TOTP} onChange={loadUser} />
          <PasskeyCard loginId={loginId} onChange={loadUser} />
        </>
      )}
    </section>
  );
}

function ProfileCard({ user }: { user: NonNullable<MeUser> }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["User ID", <code key="id" className="text-xs">{user.userId}</code>],
    ["Login IDs", user.loginIds?.join(", ") || "—"],
    ["Name", user.name || "—"],
    [
      "Email",
      <span key="email" className="inline-flex items-center gap-1">
        {user.email || "—"}
        {user.verifiedEmail && (
          <BadgeCheck className="h-4 w-4 text-emerald-600" />
        )}
      </span>,
    ],
    [
      "Created",
      user.createdTime
        ? new Date(user.createdTime * 1000).toLocaleString()
        : "—",
    ],
    ["Status", user.status ?? "—"],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" /> Profile
        </CardTitle>
        <CardDescription>Loaded live from the Descope API.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs uppercase text-muted-foreground">
                {label}
              </dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function TotpCard({
  loginId,
  enrolled,
  onChange,
}: {
  loginId: string;
  enrolled: boolean;
  onChange: () => void;
}) {
  const [totp, setTotp] = useState<{
    image: string;
    provisioningURL: string;
    key: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const begin = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const sdk = getDescope();
      // update() adds a TOTP factor to the currently authenticated user.
      const res = await sdk.totp.update(loginId, getToken());
      if (!res.ok || !res.data) {
        setErr(res.error?.errorMessage ?? "Could not start TOTP enrollment");
        return;
      }
      setTotp(res.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await getDescope().totp.verify(loginId, code);
      if (!res.ok) {
        setErr(res.error?.errorMessage ?? "Invalid code");
        return;
      }
      setMsg("TOTP enrolled successfully.");
      setTotp(null);
      setCode("");
      onChange();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Authenticator app (TOTP)
          <StatusBadge on={enrolled} />
        </CardTitle>
        <CardDescription>
          Enroll a time-based one-time-password authenticator (Google
          Authenticator, 1Password, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!totp && (
          <Button onClick={begin} disabled={busy} variant="outline">
            {busy
              ? "Please wait…"
              : enrolled
                ? "Re-enroll authenticator"
                : "Enroll authenticator"}
          </Button>
        )}

        {totp && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={totp.image}
                alt="TOTP QR code"
                className="h-40 w-40 rounded border bg-white p-2"
              />
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Scan the QR, or enter this key manually:
                </p>
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">
                  {totp.key}
                </code>
              </div>
            </div>
            <form onSubmit={verify} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">
                  6-digit code
                </label>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                Verify
              </Button>
            </form>
          </div>
        )}

        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}

function PasskeyCard({
  loginId,
  onChange,
}: {
  loginId: string;
  onChange: () => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getDescope()
      .webauthn.helpers.isSupported()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);

  const enroll = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const sdk = getDescope();
      // The combined callable runs the full WebAuthn ceremony via helpers and
      // adds the passkey to the currently authenticated user.
      const res = await sdk.webauthn.update(loginId, getToken());
      if (!res.ok) {
        setErr(res.error?.errorMessage ?? "Passkey enrollment failed");
        return;
      }
      setMsg("Passkey enrolled successfully.");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Passkey enrollment cancelled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" /> Passkey / WebAuthn
        </CardTitle>
        <CardDescription>
          Register a device biometric or security key as a passkey.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {supported === false ? (
          <p className="text-sm text-muted-foreground">
            This browser/device does not support WebAuthn passkeys.
          </p>
        ) : (
          <Button
            onClick={enroll}
            disabled={busy || supported === null}
            variant="outline"
          >
            {busy ? "Follow the prompt…" : "Add a passkey"}
          </Button>
        )}
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        on
          ? "bg-emerald-100 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      {on ? (
        <ShieldCheck className="h-3 w-3" />
      ) : (
        <ShieldOff className="h-3 w-3" />
      )}
      {on ? "Enrolled" : "Not enrolled"}
    </span>
  );
}
