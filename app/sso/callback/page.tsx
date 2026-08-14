"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getDescope,
  getToken,
  persistSessionCookie,
} from "@/lib/descope-client";
import { POST_LOGIN_PATH } from "@/lib/descope-config";

/**
 * Module-level guard: the OIDC token exchange must run exactly once per page
 * load. React Strict Mode (dev) double-invokes effects, and a second
 * finishLoginIfNeed() call fails with "Invalid PKCE" because the first call
 * already consumed the stored code_verifier. A ref won't survive the Strict
 * Mode remount; a module-scoped flag does.
 */
let exchangeStarted = false;

/**
 * OIDC redirect landing page for the SSO demo. Descope sends the user here with
 * `?code=...&state=...`. finishLoginIfNeed exchanges those for a session (and
 * sets the `DS` cookie), after which we forward to the profile page.
 */
export default function SsoCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeStarted) return;
    exchangeStarted = true;

    (async () => {
      try {
        await getDescope().oidc.finishLoginIfNeed();
        // Mirror the OIDC session into the `DS` cookie the proxy validates.
        persistSessionCookie(getToken());
        router.replace(POST_LOGIN_PATH);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not complete SSO login",
        );
      }
    })();
  }, [router]);

  return (
    <section className="flex justify-center">
      <p className="mt-24 text-sm text-muted-foreground">
        {error ?? "Completing sign-in…"}
      </p>
    </section>
  );
}
