"use client";

import { useEffect, useState } from "react";
import { Check, Copy, LogOut, Network, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  forceRefreshOidcSession,
  getDescopeOidc,
  getOidcIdToken,
  getOidcRefreshToken,
  getOidcSessionToken,
  logoutOidcApplicationSession,
} from "@/lib/descope-client";
import { absoluteUrl } from "@/lib/descope-config";

const SSO_CALLBACK_PATH = "/sso/callback";
const SILENT_CALLBACK_PATH = "/silent-callback.html";

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(normalized), (character) =>
      character.charCodeAt(0),
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Flow 5 — SSO Demo (OIDC hosted login).
 * Uses Descope's OIDC redirect flow: loginWithRedirect builds the correct
 * hosted-login URL and navigates there. On return, /sso/callback completes the
 * login (finishLoginIfNeed) and forwards to the profile.
 */
export default function SsoDemoPage() {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loggingOutApplication, setLoggingOutApplication] = useState(false);
  const [loggingOutOidc, setLoggingOutOidc] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const descope = getDescopeOidc();
    const updateSession = (token = getOidcSessionToken()) => {
      const validToken = token && !descope.isJwtExpired(token) ? token : null;
      setSessionToken(validToken);
      setIdToken(validToken ? getOidcIdToken() || null : null);
      setSessionChecked(true);
    };

    const stopListening = descope.onSessionTokenChange(updateSession);
    const currentToken = getOidcSessionToken();

    if (
      currentToken &&
      descope.isJwtExpired(currentToken) &&
      getOidcRefreshToken()
    ) {
      void forceRefreshOidcSession()
        .then(updateSession)
        .catch(() => updateSession(currentToken));
    } else {
      updateSession(currentToken);
    }

    return () => {
      stopListening();
    };
  }, []);

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      // disableNavigation=false (default) lets the SDK navigate to the hosted
      // login page itself after building the request.
      const res = await getDescopeOidc().oidc.loginWithRedirect({
        redirect_uri: absoluteUrl(SSO_CALLBACK_PATH),
      });
      if (res?.ok === false) {
        setError(res.error?.errorMessage ?? "Could not start SSO login");
        setBusy(false);
      }
      // On success the SDK redirects the browser away; nothing more to do.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setBusy(false);
    }
  };

  const silentAuth = async () => {
    setBusy(true);
    setError(null);

    const iframe = document.createElement("iframe");
    iframe.hidden = true;

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      iframe.remove();
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type !== "authorization_response") return;

      const response = event.data.response as
        | { code?: string; error?: string; state?: string }
        | undefined;
      if (!response?.state) return;

      cleanup();

      if (response.error === "login_required") {
        await login();
        return;
      }

      if (response.error || !response.code) {
        setError(response.error || "Silent authentication returned no code");
        setBusy(false);
        return;
      }

      try {
        const callbackUrl = new URL(absoluteUrl(SILENT_CALLBACK_PATH));
        callbackUrl.searchParams.set("code", response.code);
        callbackUrl.searchParams.set("state", response.state);

        await getDescopeOidc().oidc.finishLogin(callbackUrl.toString());

        const token = getOidcSessionToken();
        if (!token || getDescopeOidc().isJwtExpired(token)) {
          throw new Error("Token exchange did not return a valid session");
        }

        setSessionToken(token);
        setIdToken(getOidcIdToken() || null);
        setSessionChecked(true);
        setCopied(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not complete silent authentication",
        );
      } finally {
        setBusy(false);
      }
    };

    try {
      const result = await getDescopeOidc().oidc.loginWithRedirect(
        {
          redirect_uri: absoluteUrl(SILENT_CALLBACK_PATH),
          prompt: "none",
        },
        true,
      );
      const authorizeUrl = result.data?.url;

      if (!result.ok || !authorizeUrl) {
        throw new Error(
          result.error?.errorMessage || "Could not start silent authentication",
        );
      }

      window.addEventListener("message", handleMessage);
      iframe.src = authorizeUrl;
      document.body.appendChild(iframe);
    } catch (err) {
      cleanup();
      setError(
        err instanceof Error
          ? err.message
          : "Could not start silent authentication",
      );
      setBusy(false);
    }
  };

  const copyAccessToken = async () => {
    if (!sessionToken) return;

    setError(null);
    try {
      await navigator.clipboard.writeText(sessionToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy access token");
    }
  };

  const refreshSession = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const token = await forceRefreshOidcSession();
      setSessionToken(token);
      setIdToken(getOidcIdToken() || null);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh OIDC session");
    } finally {
      setRefreshing(false);
    }
  };

  const logoutApplication = async () => {
    setLoggingOutApplication(true);
    setError(null);
    try {
      await logoutOidcApplicationSession();
      setSessionToken(null);
      setIdToken(null);
      setCopied(false);
    } catch (err) {
      if (!getOidcSessionToken()) {
        setSessionToken(null);
        setIdToken(null);
        setCopied(false);
      }
      setError(
        err instanceof Error
          ? err.message
          : "Could not log out the application session",
      );
    } finally {
      setLoggingOutApplication(false);
    }
  };

  const logoutOidc = async () => {
    setLoggingOutOidc(true);
    setError(null);
    try {
      await getDescopeOidc().oidc.logout({
        post_logout_redirect_uri: absoluteUrl("/sso/app"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoggingOutOidc(false);
    }
  };

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <Network className="mx-auto h-8 w-8 text-cyan-600" />
          <CardTitle className="mt-2">SSO Demo</CardTitle>
          <CardDescription>
            Sign in via Descope&apos;s hosted OIDC login page. OIDC application
            tokens are kept separate from native authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">
              {!sessionChecked
                ? "Checking for an OIDC application session…"
                : sessionToken
                  ? "OIDC application session found"
                  : "No OIDC application session found"}
            </p>
            {sessionToken && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full gap-2"
                  onClick={copyAccessToken}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Access token copied" : "Copy access token"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full gap-2"
                  onClick={refreshSession}
                  disabled={refreshing || !getOidcRefreshToken()}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  {refreshing ? "Refreshing…" : "Refresh access token"}
                </Button>
                <div className="mt-3">
                  <p className="font-medium">Decoded ID token</p>
                  {idToken && decodeJwtPayload(idToken) ? (
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs">
                      {JSON.stringify(decodeJwtPayload(idToken), null, 2)}
                    </pre>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No ID token is available for this session.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full gap-2"
                  onClick={logoutApplication}
                  disabled={loggingOutApplication || loggingOutOidc}
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOutApplication
                    ? "Logging out application…"
                    : "Log out this application"}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Clears this application&apos;s tokens while keeping shared SSO
                  signed in for silent authentication.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full gap-2"
                  onClick={logoutOidc}
                  disabled={loggingOutApplication || loggingOutOidc}
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOutOidc ? "Logging out…" : "Log out OIDC session"}
                </Button>
              </>
            )}
          </div>
          {sessionChecked && !sessionToken && (
            <>
              <Button className="w-full" onClick={login} disabled={busy}>
                {busy ? "Redirecting…" : "Sign in with SSO"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={silentAuth}
                disabled={busy}
              >
                {busy ? "Authenticating…" : "Silent auth"}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
