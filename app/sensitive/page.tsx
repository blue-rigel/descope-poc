"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Fingerprint,
  KeyRound,
  Lock,
  LockOpen,
  ShieldAlert,
  ShieldCheck,
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
import {
  getDescope,
  getRefreshJwt,
  getToken,
  persistSessionCookie,
} from "@/lib/descope-client";
import { POST_LOGIN_PATH } from "@/lib/descope-config";
import { cn } from "@/lib/utils";

type Claims = {
  amr?: string[];
  iat?: number;
  exp?: number;
  su?: boolean;
  stepup?: boolean;
  [k: string]: unknown;
};

type MeUser = Awaited<ReturnType<ReturnType<typeof getDescope>["me"]>>["data"];

/** Decode a JWT payload without verifying (display only). */
function decodeJwt(token: string): Claims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Claims;
  } catch {
    return null;
  }
}

/**
 * True once a second factor has been satisfied. Descope signals this two ways,
 * independent of the primary login method (password OR oauth): the token gains
 * `su: true` and an `mfa` entry in `amr` after step-up. Either is authoritative.
 */
function isMfaSatisfied(claims: Claims | null): boolean {
  if (!claims) return false;
  const amr = claims.amr ?? [];
  return claims.su === true || amr.includes("mfa");
}

/**
 * Assurance level per THIS project's model, derived from the token's `amr`
 * (there is no explicit `aal`/`acr` claim):
 *   AAL1 = single primary factor, no password (e.g. social/oauth only)
 *   AAL2 = password primary (`pwd`), no MFA yet
 *   AAL3 = MFA satisfied (`su:true` / `mfa` in amr) — the step-up target
 */
function assuranceLevel(claims: Claims | null): 1 | 2 | 3 {
  if (isMfaSatisfied(claims)) return 3;
  const amr = claims?.amr ?? [];
  return amr.includes("pwd") ? 2 : 1;
}

/** The sensitive action requires MFA to be satisfied (AAL3). */
const REQUIRED_AAL = 3;

export default function SensitivePage() {
  const [user, setUser] = useState<MeUser | undefined>(undefined);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accept an explicit JWT (the one just returned by step-up) so we don't race
  // the SDK's async write to storage; fall back to whatever is stored.
  const refreshClaims = useCallback((jwt?: string) => {
    setClaims(decodeJwt(jwt || getToken()));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDescope().me();
      if (!res.ok) {
        setError(res.error?.errorMessage ?? "Could not load profile");
        return;
      }
      setUser(res.data);
      refreshClaims();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [refreshClaims]);

  useEffect(() => {
    void load();
  }, [load]);

  const loginId = user?.loginIds?.[0] ?? "";
  const aal = assuranceLevel(claims);
  const stepped = aal >= REQUIRED_AAL;
  const hasTotp = Boolean(user?.TOTP);
  // `me()` doesn't expose passkey enrollment directly; webauthn shows up under
  // the WebAuthn field on some projects. Fall back to "offer it and let the
  // ceremony fail gracefully" when unknown.
  const hasPasskey = Boolean(
    (user as { webauthn?: boolean } | undefined)?.webauthn,
  );
  const hasAnyMfa = hasTotp || hasPasskey;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Step-up Auth Demo</h1>
        <p className="text-sm text-muted-foreground">
          This route is protected by primary login (via the auth middleware).
          The sensitive action below additionally requires MFA — a live step-up
          to AAL3 (password + a second factor).
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading session…</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {user && (
        <>
          <AssessmentPanel
            claims={claims}
            aal={aal}
            stepped={stepped}
            user={user}
          />

          {!hasAnyMfa && <NoMfaNotice user={user} />}

          <SensitiveArea
            stepped={stepped}
            loginId={loginId}
            hasTotp={hasTotp}
            hasPasskey={hasPasskey}
            hasAnyMfa={hasAnyMfa}
            onSteppedUp={refreshClaims}
          />
        </>
      )}
    </section>
  );
}

const AAL_LABELS: Record<1 | 2 | 3, string> = {
  1: "AAL1 — no password",
  2: "AAL2 — password",
  3: "AAL3 — password + MFA",
};

function AssessmentPanel({
  claims,
  aal,
  stepped,
  user,
}: {
  claims: Claims | null;
  aal: 1 | 2 | 3;
  stepped: boolean;
  user: NonNullable<MeUser>;
}) {
  const amr = claims?.amr ?? [];
  const fmt = (t?: number) =>
    t ? new Date(t * 1000).toLocaleString() : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {stepped ? (
            <LockOpen className="h-5 w-5 text-emerald-600" />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground" />
          )}
          Session assessment
          <span
            className={cn(
              "ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium",
              stepped
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700",
            )}
          >
            {AAL_LABELS[aal]}
          </span>
        </CardTitle>
        <CardDescription>
          Decoded live from the current session JWT (display only — not
          re-verified in the browser).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Row label="Subject (user)">{user.loginIds?.[0] ?? user.userId}</Row>
          <Row label="AAL (assurance level)">{aal}</Row>
          <Row label="Issued at">{fmt(claims?.iat)}</Row>
          <Row label="Expires">{fmt(claims?.exp)}</Row>
        </dl>

        <div>
          <div className="mb-1 text-xs uppercase text-muted-foreground">
            AMR — authentication methods in this token
          </div>
          {amr.length ? (
            <div className="flex flex-wrap gap-1.5">
              {amr.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No <code>amr</code> claim present in this token.
            </p>
          )}
        </div>

        {claims && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Raw JWT claims
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(claims, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function NoMfaNotice({ user }: { user: NonNullable<MeUser> }) {
  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
          No second factor enrolled
        </CardTitle>
        <CardDescription className="text-amber-800/80">
          <span className="font-medium">
            {user.name || user.loginIds?.[0] || user.userId}
          </span>{" "}
          has no MFA factor on file, so this session can&apos;t step up to AAL3.
          Enroll an authenticator or passkey first, then come back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href={POST_LOGIN_PATH}>Go to Account Settings →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SensitiveArea({
  stepped,
  loginId,
  hasTotp,
  hasPasskey,
  hasAnyMfa,
  onSteppedUp,
}: {
  stepped: boolean;
  loginId: string;
  hasTotp: boolean;
  hasPasskey: boolean;
  hasAnyMfa: boolean;
  onSteppedUp: (jwt?: string) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const afterStepUp = (sessionJwt: string) => {
    const jwt = sessionJwt || getToken();
    // Mirror the elevated session into the DS cookie and decode the fresh token
    // directly (don't re-read storage, which may not be written yet).
    persistSessionCookie(jwt);
    onSteppedUp(jwt);
  };

  const stepUpTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await getDescope().totp.verify(
        loginId,
        code,
        { stepup: true },
        getRefreshJwt(),
      );
      if (!res.ok) {
        setErr(res.error?.errorMessage ?? "Invalid code");
        return;
      }
      setCode("");
      afterStepUp(res.data?.sessionJwt ?? "");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Step-up failed");
    } finally {
      setBusy(false);
    }
  };

  const stepUpPasskey = async () => {
    setBusy(true);
    setErr(null);
    try {
      const sdk = getDescope();
      const start = await sdk.webauthn.signIn.start(
        loginId,
        window.location.origin,
        { stepup: true },
        getRefreshJwt(),
      );
      if (!start.ok || !start.data) {
        setErr(start.error?.errorMessage ?? "Could not start passkey step-up");
        return;
      }
      const response = await sdk.webauthn.helpers.get(start.data.options);
      const finish = await sdk.webauthn.signIn.finish(
        start.data.transactionId,
        response,
      );
      if (!finish.ok) {
        setErr(finish.error?.errorMessage ?? "Passkey step-up failed");
        return;
      }
      afterStepUp(finish.data?.sessionJwt ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Passkey step-up cancelled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Sensitive action
        </CardTitle>
        <CardDescription>
          A pretend high-risk operation (e.g. transfer funds, delete account)
          that requires AAL3.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stepped ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <LockOpen className="h-4 w-4" />
            Step-up satisfied — you may perform the sensitive action.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Lock className="h-4 w-4" />
            Locked — complete a second factor to continue.
          </div>
        )}

        <Button disabled={!stepped} className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          Perform sensitive action
        </Button>

        {!stepped && hasAnyMfa && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">Step up with:</p>

            {hasTotp && (
              <form onSubmit={stepUpTotp} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    Authenticator code
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
                <Button type="submit" disabled={busy} variant="outline">
                  Verify code
                </Button>
              </form>
            )}

            {hasPasskey && (
              <Button
                onClick={stepUpPasskey}
                disabled={busy}
                variant="outline"
                className="gap-2"
              >
                <Fingerprint className="h-4 w-4" />
                {busy ? "Follow the prompt…" : "Use a passkey"}
              </Button>
            )}
          </div>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
