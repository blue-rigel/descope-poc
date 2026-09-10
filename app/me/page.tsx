"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Clock3,
  LogOut,
  MailCheck,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  forceRefreshSession,
  getDescope,
  getToken,
} from "@/lib/descope-client";
import { absoluteUrl, LOGIN_PATH } from "@/lib/descope-config";

type MeUser = Awaited<
  ReturnType<ReturnType<typeof getDescope>["me"]>
>["data"];

function getSessionExpiration(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(normalized)) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function formatRemaining(expiration: number, now: number) {
  const remainingSeconds = Math.max(0, Math.ceil((expiration - now) / 1000));
  if (remainingSeconds === 0) return "Expired";

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s remaining`;
}

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [sessionExpiration, setSessionExpiration] = useState<number | null>(() =>
    getSessionExpiration(getToken()),
  );
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getDescope()
      .me()
      .then((res) => {
        if (!active) return;
        if (!res.ok || !res.data) {
          setError(res.error?.errorMessage ?? "Could not load user profile");
          return;
        }
        setUser(res.data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load user profile");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const stopListening = getDescope().onSessionTokenChange((sessionJwt) => {
      setSessionExpiration(getSessionExpiration(sessionJwt));
      setNow(Date.now());
    });
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopListening();
      window.clearInterval(interval);
    };
  }, []);

  const refreshSession = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const sessionJwt = await forceRefreshSession();
      setSessionExpiration(getSessionExpiration(sessionJwt));
      setNow(Date.now());
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not refresh session",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await getDescope().logout();
    } finally {
      router.replace(LOGIN_PATH);
      router.refresh();
    }
  };

  const sendVerificationEmail = async () => {
    if (!user?.email) return;

    setSendingVerification(true);
    setVerificationMessage(null);
    setError(null);
    try {
      const loginId = user.loginIds?.[0] || user.email;
      const res = await getDescope().magicLink.update.email(
        loginId,
        user.email,
        absoluteUrl("/auth/verify-email"),
      );

      if (!res.ok) {
        setError(res.error?.errorMessage ?? "Could not send verification email");
        return;
      }

      setVerificationMessage(
        `Verification email sent to ${res.data?.maskedEmail || user.email}.`,
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send verification email",
      );
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserRound className="h-5 w-5 text-indigo-600" />
                My Profile
              </CardTitle>
              <CardDescription className="mt-2">
                Information for the currently authenticated user.
              </CardDescription>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={refreshSession}
                disabled={loading || refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing" : "Force refresh"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={logout}
                disabled={loading || refreshing}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-sm text-muted-foreground">Loading profile…</p>
          )}
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {user && (
            <UserDetails
              user={user}
              sessionExpiration={sessionExpiration}
              now={now}
              sendingVerification={sendingVerification}
              verificationMessage={verificationMessage}
              onSendVerification={sendVerificationEmail}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function UserDetails({
  user,
  sessionExpiration,
  now,
  sendingVerification,
  verificationMessage,
  onSendVerification,
}: {
  user: NonNullable<MeUser>;
  sessionExpiration: number | null;
  now: number;
  sendingVerification: boolean;
  verificationMessage: string | null;
  onSendVerification: () => void;
}) {
  const rows = [
    ["Name", user.name || "—"],
    ["Email", user.email || "—"],
    ["Login IDs", user.loginIds?.join(", ") || "—"],
    ["User ID", user.userId],
    ["Status", user.status || "—"],
    [
      "Created",
      user.createdTime
        ? new Date(user.createdTime * 1000).toLocaleString()
        : "—",
    ],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Clock3 className="h-5 w-5 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Session expiry</p>
            <p className="text-sm text-muted-foreground">
              {sessionExpiration
                ? new Date(sessionExpiration).toLocaleString()
                : "Unavailable"}
            </p>
          </div>
        </div>
        {sessionExpiration && (
          <p
            className={`shrink-0 text-sm font-medium ${
              sessionExpiration <= now ? "text-destructive" : "text-emerald-700"
            }`}
          >
            {formatRemaining(sessionExpiration, now)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {user.name || user.email || user.loginIds?.[0] || user.userId}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {user.verifiedEmail && (
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
            )}
            {user.verifiedEmail ? "Verified account" : "Authenticated account"}
          </p>
        </div>
        {!user.verifiedEmail && user.email && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onSendVerification}
            disabled={sendingVerification}
          >
            <MailCheck className="h-4 w-4" />
            {sendingVerification ? "Sending…" : "Send verification email"}
          </Button>
        )}
      </div>

      {verificationMessage && (
        <p role="status" className="text-sm text-emerald-700">
          {verificationMessage}
        </p>
      )}

      <dl className="divide-y rounded-lg border">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="break-all text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
