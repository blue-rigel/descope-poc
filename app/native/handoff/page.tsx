"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { POST_LOGIN_PATH } from "@/lib/descope-config";
import {
  isNativePlatform,
  readClientConfig,
  readMobileParameters,
} from "@/lib/native-config";
import { startNativeAuthorization } from "@/lib/native-handoff";

/**
 * Hand-off step 1 — the user is authenticated in the webview, so ask the IdP
 * for an authorization code on this app's client. The code comes back to
 * `/native/callback`, which deep-links it to the app.
 * See `docs/non-web-platform-flow.md` §5.
 */

/** The authorization hop must be started once per page load. */
let authorizationStarted = false;

export default function NativeHandoffPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authorizationStarted) return;
    authorizationStarted = true;

    const config = readClientConfig();

    if (!config) {
      setError("No native launch context — open /native/login first.");
      return;
    }

    if (!isNativePlatform(config.platform)) {
      // Web launches keep their session in this browser; nothing to hand off.
      window.location.replace(POST_LOGIN_PATH);
      return;
    }

    startNativeAuthorization(config).catch((cause: unknown) => {
      authorizationStarted = false;
      setError(
        cause instanceof Error ? cause.message : "Could not return to the app",
      );
    });
  }, []);

  const mobile = typeof window === "undefined" ? null : readMobileParameters();

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <CardTitle className="mt-2">
            {error ? "Hand-off failed" : "You're signed in"}
          </CardTitle>
          <CardDescription>
            {error ?? "Returning you to the app…"}
          </CardDescription>
        </CardHeader>
        {mobile && (
          <CardContent>
            <p className="text-center text-xs text-muted-foreground">
              {mobile.platform}
              {mobile.appVersion ? ` · app ${mobile.appVersion}` : ""}
              {mobile.osVersion ? ` · OS ${mobile.osVersion}` : ""}
            </p>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
