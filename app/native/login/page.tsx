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
import { getDescope } from "@/lib/descope-client";
import {
  captureMobileParameters,
  clearHandoff,
  isHandoffInFlight,
  isNativePlatform,
  NATIVE_HANDOFF_PATH,
  resolveClientConfig,
} from "@/lib/native-config";
import { prepareNativeLaunch, storeAppLaunchParams } from "@/lib/native-handoff";

import { NativeLoginForm } from "./_components/native-login-form";

/**
 * Native webview host (the counterpart of the legacy `mysph-standalone`
 * `/login` page — see `docs/ARCHITECTURE.md`).
 *
 * A native app opens:
 *   /native/login?pubId=st&platform=ios&redirectUrl=myapp://auth
 *                &deviceId=…&osVersion=…&appVersion=…&state=…
 *
 * The app has no authentication screens of its own, so this page renders the
 * login form itself. Once the user is authenticated it moves on to
 * `/native/handoff`, which mints the code the app exchanges.
 */

/** The bootstrap must run once per page load, not twice under Strict Mode. */
let bootstrapStarted = false;

type Status = "loading" | "ready" | "inflight" | "error";

export default function NativeLoginPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;

    // Redirect-in-flight guard: the hand-off is already navigating this webview
    // away. Re-running the flow here would fight it, so render nothing.
    if (isHandoffInFlight()) {
      setStatus("inflight");
      return;
    }

    (async () => {
      try {
        const params = new URL(window.location.href).searchParams;
        // Social sign-in comes back here as a full-page redirect; that leg must
        // not be mistaken for a fresh launch and wipe the session it just made.
        const socialCode = params.get("code");
        const config = await resolveClientConfig(params);

        if (!socialCode) {
          captureMobileParameters(params, config);
          storeAppLaunchParams(params);
          clearHandoff();

          if (isNativePlatform(config.platform)) {
            // A session left behind by a previous run would authorize the wrong
            // user — start from a clean slate before showing the form.
            await prepareNativeLaunch();
          }

          setStatus("ready");
          return;
        }

        const exchanged = await getDescope().oauth.exchange(socialCode);
        if (!exchanged.ok) {
          setError(
            exchanged.error?.errorMessage ?? "Could not complete social sign-in",
          );
          setStatus("error");
          return;
        }

        window.location.replace(NATIVE_HANDOFF_PATH);
      } catch (cause) {
        bootstrapStarted = false;
        setError(
          cause instanceof Error ? cause.message : "Could not start the login flow",
        );
        setStatus("error");
      }
    })();
  }, []);

  if (status === "inflight") return null;

  return (
    <section className="flex justify-center px-4">
      <Card className="w-full max-w-md mt-12">
        <CardHeader className="text-center">
          <Smartphone className="mx-auto h-8 w-8 text-emerald-600" />
          <CardTitle className="mt-2">
            {status === "error" ? "Cannot start sign-in" : "Sign in"}
          </CardTitle>
          <CardDescription>
            {status === "error"
              ? error
              : status === "ready"
                ? "Use your account to continue in the app."
                : "Preparing the sign-in form…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "ready" && (
            <NativeLoginForm
              onAuthenticated={() =>
                window.location.replace(NATIVE_HANDOFF_PATH)
              }
            />
          )}
          {status === "error" && (
            <p className="text-sm text-muted-foreground">
              Open this page with <code>pubId</code> plus either a hosted client
              config or <code>platform</code> and <code>redirectUrl</code> query
              parameters.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
