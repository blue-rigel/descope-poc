"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  type ClientConfig,
} from "@/lib/native-config";
import { handOffToNativeApp } from "@/lib/native-handoff";

/**
 * Session hand-off page — the second hop of the native flow.
 *
 * The BYOS flow returns here (`?from=/native/handoff`) once the user is
 * authenticated. We then mint a fresh authorization `code` for the app's deep
 * link and leave the webview; the app exchanges that code for its own tokens.
 * See `docs/non-web-platform-flow.md` §5.
 */
export default function NativeHandoffPage() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readClientConfig();

    if (!stored) {
      setError("No native launch context — open /native/login first.");
      return;
    }

    if (!isNativePlatform(stored.platform)) {
      // Web launches keep their session in the browser; nothing to hand off.
      window.location.replace(POST_LOGIN_PATH);
      return;
    }

    setConfig(stored);

    // Android webviews block a navigation that no user gesture initiated, so
    // the redirect has to sit behind a tap (legacy did this for Android +
    // Google). iOS hands off immediately.
    if (stored.platform === "android") {
      setNeedsGesture(true);
      return;
    }

    try {
      handOffToNativeApp(stored);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not return to the app",
      );
    }
  }, []);

  const finish = () => {
    if (!config) return;
    try {
      handOffToNativeApp(config);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not return to the app",
      );
    }
  };

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
            {error ??
              (needsGesture
                ? "Finish to return to the app."
                : "Returning you to the app…")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {needsGesture && !error && (
            <Button className="w-full" onClick={finish}>
              Finish
            </Button>
          )}
          {mobile && (
            <p className="text-center text-xs text-muted-foreground">
              {mobile.platform}
              {mobile.appVersion ? ` · app ${mobile.appVersion}` : ""}
              {mobile.osVersion ? ` · OS ${mobile.osVersion}` : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
