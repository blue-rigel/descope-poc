"use client";

import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDescope } from "@/lib/descope-client";
import { absoluteUrl } from "@/lib/descope-config";
import { NATIVE_LOGIN_PATH } from "@/lib/native-config";
import { setSilentAuthorization } from "@/lib/native-handoff";

/**
 * The login form the native apps show. Everything the user sees during
 * authentication lives here — the apps ship no auth screens of their own — so
 * this covers the three methods the flows support: email + password, an email
 * one-time code, and Google.
 *
 * On success the host navigates to `/native/handoff`, which mints an
 * authorization code for Federated App MAGW_Mobile_App and returns it on the
 * app's `redirectUrl` (use `/native/auth-code` while testing in a browser).
 */

const CODE_LENGTH = 6;
type Step = "credentials" | "code";
type Mode = "signin" | "signup";

function errorText(value: unknown, fallback = "Authentication failed"): string {
  if (!value || typeof value !== "object") {
    return value instanceof Error ? value.message : fallback;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["errorDescription", "errorMessage"] as const) {
    if (typeof record[key] === "string" && record[key]) return record[key];
  }
  for (const key of ["error", "data", "cause"] as const) {
    if (key in record) {
      const nested = errorText(record[key], "");
      if (nested) return nested;
    }
  }
  return fallback;
}

export function NativeLoginForm({
  onAuthenticated,
}: {
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginId = email.trim();

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    setError(null);
    try {
      if (await action()) onAuthenticated();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const sdk = getDescope();
      const result =
        mode === "signin"
          ? await sdk.password.signIn(loginId, password)
          : await sdk.password.signUp(loginId, password);

      if (!result.ok) {
        setError(errorText(result.error));
        return false;
      }

      // Signed in from this origin, not through the IdP — the hand-off cannot
      // rely on a session cookie it will not be able to present.
      setSilentAuthorization(false);
      return true;
    });
  };

  const sendCode = () => {
    if (!loginId.includes("@")) {
      setError("Enter a valid email address");
      return;
    }

    void run(async () => {
      const result = await getDescope().otp.signUpOrIn.email(loginId);
      if (!result.ok) {
        setError(errorText(result.error, "Could not send the code"));
        return false;
      }
      setMaskedEmail(result.data?.maskedEmail ?? loginId);
      setCode("");
      setStep("code");
      return false;
    });
  };

  const verifyCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const result = await getDescope().otp.verify.email(loginId, code);
      if (!result.ok) {
        setError(errorText(result.error, "That code is not valid"));
        return false;
      }

      setSilentAuthorization(false);
      return true;
    });
  };

  const startGoogle = () => {
    void run(async () => {
      // A webview cannot use the popup dance the web pages use, so this is a
      // full-page redirect that returns to /native/login with `?code=`.
      // Google refuses OAuth inside an embedded webview, so the host app must
      // open this leg in the system browser (Custom Tabs / ASWebAuthenticationSession).
      const result = await getDescope().oauth.start.google(
        absoluteUrl(NATIVE_LOGIN_PATH),
      );
      if (!result.ok || !result.data?.url) {
        setError(errorText(result.error, "Could not start Google sign-in"));
        return false;
      }
      // A top-level trip to the IdP leaves a session it recognises, so the
      // hand-off can stay silent on the way back.
      setSilentAuthorization(true);
      window.location.assign(result.data.url);
      return false;
    });
  };

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter the {CODE_LENGTH}-digit code sent to {maskedEmail || loginId}.
        </p>
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="123456"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          autoFocus
          required
          className="text-center font-mono text-xl tracking-[0.4em]"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={busy || code.length !== CODE_LENGTH}
        >
          {busy ? "Verifying…" : "Verify and continue"}
        </Button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-muted-foreground underline underline-offset-4"
            onClick={() => setStep("credentials")}
            disabled={busy}
          >
            Use a different email
          </button>
          <button
            type="button"
            className="text-foreground underline underline-offset-4"
            onClick={sendCode}
            disabled={busy}
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitPassword} className="space-y-3">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={sendCode}
        disabled={busy}
      >
        <Mail className="h-4 w-4" />
        Email me a code
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={startGoogle}
        disabled={busy}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/google-g.svg" alt="" className="h-4 w-4" />
        Continue with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="text-foreground underline underline-offset-4"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          disabled={busy}
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
