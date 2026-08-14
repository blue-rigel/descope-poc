"use client";

import { useState } from "react";
import { Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDescope } from "@/lib/descope-client";
import { absoluteUrl } from "@/lib/descope-config";

const SSO_CALLBACK_PATH = "/sso/callback";

/**
 * Flow 5 — SSO Demo (OIDC hosted login).
 * Uses Descope's OIDC redirect flow: loginWithRedirect builds the correct
 * hosted-login URL and navigates there. On return, /sso/callback completes the
 * login (finishLoginIfNeed) and forwards to the profile.
 */
export default function SsoDemoPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      // disableNavigation=false (default) lets the SDK navigate to the hosted
      // login page itself after building the request.
      const res = await getDescope().oidc.loginWithRedirect({
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

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <Network className="mx-auto h-8 w-8 text-cyan-600" />
          <CardTitle className="mt-2">SSO Demo</CardTitle>
          <CardDescription>
            Sign in via Descope&apos;s hosted OIDC login page. On success you are
            redirected back and land on your profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={login} disabled={busy}>
            {busy ? "Redirecting…" : "Sign in with SSO"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
