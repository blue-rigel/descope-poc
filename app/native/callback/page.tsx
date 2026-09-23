"use client";

import { useEffect, useState } from "react";
import { ArrowRightCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { readClientConfig, type ClientConfig } from "@/lib/native-config";
import {
  handOffToNativeApp,
  reportFailureToNativeApp,
  startNativeAuthorization,
} from "@/lib/native-handoff";

/**
 * Hand-off step 2 — the authorization code lands here, in the webview, so the
 * PKCE verifier generated for it can travel to the app alongside it. The app
 * exchanges the pair at `{idpBase}/{appId}/oauth2/v1/token`.
 */

/** Errors that simply mean "the silent request needs a real prompt". */
const INTERACTION_ERRORS = new Set([
  "login_required",
  "interaction_required",
  "consent_required",
  "account_selection_required",
]);
const RETRY_KEY = "mysph-native-authorize-retry";

let callbackHandled = false;

export default function NativeCallbackPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [params, setParams] = useState<URLSearchParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (callbackHandled) return;
    callbackHandled = true;

    const stored = readClientConfig();
    const search = new URL(window.location.href).searchParams;

    if (!stored) {
      setError("No native launch context — open /native/login first.");
      return;
    }

    const authorizationError = search.get("error");

    if (authorizationError) {
      // `prompt=none` could not reuse the session (a webview often cannot read
      // the IdP cookie). Retry once interactively: Descope then renders its own
      // hosted login here, which is still the web interface the app expects.
      if (
        INTERACTION_ERRORS.has(authorizationError) &&
        !window.sessionStorage.getItem(RETRY_KEY)
      ) {
        window.sessionStorage.setItem(RETRY_KEY, "1");
        startNativeAuthorization(stored, true).catch(() => {
          setConfig(stored);
          setError("Could not reach the authorization server");
        });
        return;
      }

      window.sessionStorage.removeItem(RETRY_KEY);
      reportFailureToNativeApp(stored, authorizationError);
      return;
    }

    window.sessionStorage.removeItem(RETRY_KEY);
    setConfig(stored);
    setParams(search);

    // Custom-scheme deep links need a user gesture on Android webviews. Plain
    // http(s) redirects (e.g. /native/auth-code for local testing) do not.
    const isHttpRedirect = /^https?:/i.test(stored.redirectUrl);
    if (stored.platform === "android" && !isHttpRedirect) return;

    try {
      handOffToNativeApp(stored, search);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not return to the app",
      );
    }
  }, []);

  const finish = () => {
    if (!config || !params) return;
    try {
      handOffToNativeApp(config, params);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not return to the app",
      );
    }
  };

  const needsGesture =
    !error &&
    config?.platform === "android" &&
    params !== null &&
    !/^https?:/i.test(config.redirectUrl);

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <ArrowRightCircle className="mx-auto h-8 w-8 text-emerald-600" />
          <CardTitle className="mt-2">
            {error ? "Hand-off failed" : "Almost done"}
          </CardTitle>
          <CardDescription>
            {error ??
              (needsGesture
                ? "Finish to return to the app."
                : "Returning you to the app…")}
          </CardDescription>
        </CardHeader>
        {needsGesture && (
          <CardContent>
            <Button className="w-full" onClick={finish}>
              Finish
            </Button>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
