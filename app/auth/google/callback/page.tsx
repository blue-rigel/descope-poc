"use client";

import { useEffect, useState } from "react";

const OAUTH_MESSAGE = "DESCOPE_OAUTH_CODE";

/**
 * OAuth popup landing page. Descope redirects here with `?code=...` after the
 * user authorizes with Google. We hand the code back to the opener window via
 * postMessage (same-origin only) and close the popup. The opener performs the
 * token exchange so the session lands in the main window.
 */
export default function GoogleCallbackPage() {
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (window.opener) {
      window.opener.postMessage(
        { type: OAUTH_MESSAGE, code },
        window.location.origin,
      );
      window.close();
      // If the browser refuses to close the popup, show a hint.
      setMessage("You can close this window now.");
    } else {
      setMessage(
        "This page must be opened from the Google login popup. Please return to the app and try again.",
      );
    }
  }, []);

  return (
    <section className="flex justify-center">
      <p className="mt-24 text-sm text-muted-foreground">{message}</p>
    </section>
  );
}
