"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDescopeOidc } from "@/lib/descope-client";

/**
 * Module-level guard: the OIDC token exchange must run exactly once per page
 * load. React Strict Mode (dev) double-invokes effects, and a second
 * finishLogin() call fails with "Invalid PKCE" because the first call
 * already consumed the stored code_verifier. A ref won't survive the Strict
 * Mode remount; a module-scoped flag does.
 */
let exchangeStarted = false;

/**
 * OIDC redirect landing page for the SSO demo. Descope sends the user here with
 * `?code=...&state=...`. finishLogin exchanges those for a session (and
 * stores it separately from native authentication), after which we forward to
 * the profile page.
 */
export default function SsoCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeStarted) return;
    exchangeStarted = true;

    (async () => {
      try {
        await getDescopeOidc().oidc.finishLogin();
        router.replace("/sso/app");
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
