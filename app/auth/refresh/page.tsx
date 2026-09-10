"use client";

import { useEffect, useState } from "react";

import { initializeSessionRefresh } from "@/lib/descope-client";
import { LOGIN_PATH, safeReturnPath } from "@/lib/descope-config";

export default function RefreshSessionPage() {
  const [message, setMessage] = useState("Refreshing your session...");

  useEffect(() => {
    let active = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const destination = safeReturnPath(params.get("from"));
      const authenticated = await initializeSessionRefresh();

      if (!active) return;
      if (authenticated) {
        window.location.replace(destination);
        return;
      }

      setMessage("Your session has ended. Redirecting to sign in...");
      const loginUrl = new URL(LOGIN_PATH, window.location.origin);
      loginUrl.searchParams.set("from", destination);
      window.location.replace(loginUrl);
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex justify-center">
      <p className="mt-24 text-sm text-muted-foreground">{message}</p>
    </section>
  );
}
