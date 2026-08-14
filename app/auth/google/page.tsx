"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDescope } from "@/lib/descope-client";
import { POST_LOGIN_PATH, absoluteUrl } from "@/lib/descope-config";

const OAUTH_MESSAGE = "DESCOPE_OAUTH_CODE";
const CALLBACK_PATH = "/auth/google/callback";

/**
 * Flow 3 — Continue with Google (no full-page redirect).
 * Opens Descope's Google OAuth flow in a popup. The callback page posts the
 * authorization `code` back via window.postMessage; we exchange it for a
 * session here in the opener, then route to the profile.
 */
export default function GoogleLoginPage() {
  const router = useRouter();
  const popupRef = useRef<Window | null>(null);
  const [status, setStatus] = useState<
    "idle" | "waiting" | "exchanging" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const exchange = useCallback(
    async (code: string) => {
      setStatus("exchanging");
      try {
        const res = await getDescope().oauth.exchange(code);
        if (!res.ok) {
          setError(res.error?.errorMessage ?? "Token exchange failed");
          setStatus("error");
          return;
        }
        router.push(POST_LOGIN_PATH);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
        setStatus("error");
      }
    },
    [router],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only trust messages from our own origin (the callback page).
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== OAUTH_MESSAGE) return;
      popupRef.current?.close();
      if (event.data.code) {
        void exchange(event.data.code as string);
      } else {
        setError("No authorization code returned");
        setStatus("error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [exchange]);

  const start = async () => {
    setError(null);
    setStatus("waiting");
    try {
      const redirectUrl = absoluteUrl(CALLBACK_PATH);
      const res = await getDescope().oauth.start.google(redirectUrl);
      if (!res.ok || !res.data?.url) {
        setError(res.error?.errorMessage ?? "Could not start Google login");
        setStatus("error");
        return;
      }
      popupRef.current = window.open(
        res.data.url,
        "descope-google-oauth",
        "width=500,height=650,menubar=no,toolbar=no",
      );
      if (!popupRef.current) {
        setError("Popup blocked — please allow popups and try again");
        setStatus("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setStatus("error");
    }
  };

  const busy = status === "waiting" || status === "exchanging";

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <Globe className="mx-auto h-8 w-8 text-red-600" />
          <CardTitle className="mt-2">Continue with Google</CardTitle>
          <CardDescription>
            Social sign-in via a popup — no full-page redirect. The popup returns
            the code through window.postMessage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={start} disabled={busy}>
            {status === "waiting"
              ? "Waiting for Google…"
              : status === "exchanging"
                ? "Signing you in…"
                : "Continue with Google"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
