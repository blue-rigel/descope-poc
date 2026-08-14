"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDescope } from "@/lib/descope-client";
import { POST_LOGIN_PATH } from "@/lib/descope-config";

/**
 * OIDC redirect landing page for the SSO demo. Descope sends the user here with
 * `?code=...&state=...`. finishLoginIfNeed exchanges those for a session (and
 * sets the `DS` cookie), after which we forward to the profile page.
 */
export default function SsoCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDescope().oidc.finishLoginIfNeed();
        if (cancelled) return;
        router.replace(POST_LOGIN_PATH);
        router.refresh();
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not complete SSO login",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <section className="flex justify-center">
      <p className="mt-24 text-sm text-muted-foreground">
        {error ?? "Completing sign-in…"}
      </p>
    </section>
  );
}
