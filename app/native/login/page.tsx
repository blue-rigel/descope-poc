"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LOGIN_PATH } from "@/lib/descope-config";
import {
  captureMobileParameters,
  clearHandoff,
  isHandoffInFlight,
  isNativePlatform,
  NATIVE_HANDOFF_PATH,
  resolveClientConfig,
} from "@/lib/native-config";
import { prepareNativeLaunch, storeNativePkce } from "@/lib/native-handoff";

/**
 * Native webview host (the counterpart of the legacy `mysph-standalone`
 * `/login` page — see `docs/ARCHITECTURE.md`).
 *
 * A native app opens:
 *   /native/login?pubId=st&platform=ios&redirectUrl=myapp://auth
 *                &deviceId=…&osVersion=…&appVersion=…
 *                &codeChallenge=…&codeChallengeMethod=S256&state=…
 *
 * This page renders no auth UI of its own: it resolves the publisher config,
 * captures the device context, clears any stale session, and then hands over to
 * the existing BYOS flow with `/native/handoff` as its return path.
 */

/** The bootstrap must run once per page load, not twice under Strict Mode. */
let bootstrapStarted = false;

export default function NativeLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;

    // Redirect-in-flight guard: the hand-off is already navigating this webview
    // away. Re-running the flow here would fight it, so render nothing.
    if (isHandoffInFlight()) {
      setInFlight(true);
      return;
    }

    (async () => {
      try {
        const params = new URL(window.location.href).searchParams;
        const config = await resolveClientConfig(params);
        captureMobileParameters(params, config);
        storeNativePkce(params);
        clearHandoff();

        if (isNativePlatform(config.platform)) {
          // A session left over from a previous run interferes with the new
          // one — start from a clean slate before launching the flow.
          await prepareNativeLaunch();
        }

        const target = new URL(LOGIN_PATH, window.location.origin);
        target.searchParams.set("from", NATIVE_HANDOFF_PATH);
        const ui = params.get("ui");
        if (ui) target.searchParams.set("ui", ui);
        window.location.replace(target.toString());
      } catch (cause) {
        bootstrapStarted = false;
        setError(
          cause instanceof Error ? cause.message : "Could not start the login flow",
        );
      }
    })();
  }, []);

  if (inFlight) return null;

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <Smartphone className="mx-auto h-8 w-8 text-emerald-600" />
          <CardTitle className="mt-2">
            {error ? "Cannot start sign-in" : "Starting sign-in…"}
          </CardTitle>
          <CardDescription>
            {error ?? "Preparing the in-app authentication flow."}
          </CardDescription>
        </CardHeader>
        {error && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Open this page with <code>pubId</code> plus either a hosted client
              config or <code>platform</code> and <code>redirectUrl</code> query
              parameters.
            </p>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
