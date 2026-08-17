"use client";

import createSdk, { getSessionToken } from "@descope/web-js-sdk";

import {
  DESCOPE_APP_ID,
  DESCOPE_BASE_URL,
  DESCOPE_PROJECT_ID,
  oidcIssuer,
} from "./descope-config";

/** Descope's default session-token cookie name (matches proxy.ts). */
const SESSION_COOKIE = "DS";

/** Descope's default refresh-token cookie / localStorage key. */
const REFRESH_KEY = "DSR";

/** Current session JWT (from the `DS` cookie/storage), or "" if none. */
export function getToken() {
  return getSessionToken();
}

/**
 * Current REFRESH JWT, or "" if none / stored HttpOnly. Step-up auth
 * (totp.verify / webauthn.signIn with `stepup:true`) needs this to prove the
 * existing session. Empty here means the refresh token is in an HttpOnly cookie
 * — see the note on getDescope() below.
 */
export function getRefreshJwt() {
  if (typeof document === "undefined") return "";
  // Mirror how the SDK resolves it: DSR cookie first, then localStorage. Both
  // are empty when the project stores the refresh token in an HttpOnly cookie.
  const fromCookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${REFRESH_KEY}=`))
    ?.slice(REFRESH_KEY.length + 1);
  return fromCookie || window.localStorage.getItem(REFRESH_KEY) || "";
}

/**
 * Mirror the session token into the `DS` cookie the server-side proxy reads.
 * Needed after the OIDC flow, which otherwise only stores the token in
 * localStorage. `secure` is omitted over HTTP (local dev) so the browser keeps it.
 */
export function persistSessionCookie(token: string) {
  if (!token) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${token}; path=/; SameSite=Lax${secure}`;
}

/** Expire the `DS` cookie so the proxy immediately sees the user as logged out. */
export function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Browser Descope SDK singleton.
 *
 * - `persistTokens` keeps tokens in browser storage and enables getSessionToken().
 * - `sessionTokenViaCookie` also writes the session token to the `DS` cookie so
 *   the server-side proxy middleware can read and validate it.
 * - `autoRefresh` keeps the session token fresh in the background.
 *
 * ⚠️ TOTP/WebAuthn ENROLLMENT (totp.update / webauthn.update) needs the
 * REFRESH token, which the SDK reads from the `DSR` localStorage key. That key
 * is only populated when the Descope project is NOT configured to store the
 * refresh token in an HttpOnly cookie. If enrollment fails with "Failed to find
 * JWT refresh token", flip the project setting:
 *   Descope Console → Project → Settings → Tokens (or Session Management) →
 *   turn OFF "Use HttpOnly cookie for refresh token" (a.k.a. store refresh token
 *   in local storage). With persistTokens:true, the SDK then keeps `DSR` in
 *   localStorage where getRefreshToken() can read it.
 */
let sdk: ReturnType<typeof createSdk> | undefined;

export function getDescope() {
  if (!sdk) {
    sdk = createSdk({
      projectId: DESCOPE_PROJECT_ID,
      baseUrl: DESCOPE_BASE_URL,
      persistTokens: true,
      // Write the session token to the `DS` cookie so the server-side proxy can
      // validate it. `secure` must be false over plain HTTP (local dev) or the
      // browser silently drops the cookie and every session check fails.
      sessionTokenViaCookie: {
        secure: process.env.NODE_ENV !== "development",
      },
      autoRefresh: true,
      // Enables sdk.oidc.* (hosted login via OIDC redirect). Issuer is the
      // project's OIDC endpoint; clientId defaults to the project ID.
      oidcConfig: {
        // Descope Inbound (OIDC) Application ID drives the hosted-login flow.
        // For this inbound app the app ID is ALSO the OIDC client_id — using the
        // long CLIENT_ID value here breaks the login-page redirect.
        applicationId: DESCOPE_APP_ID || DESCOPE_PROJECT_ID,
        clientId: DESCOPE_APP_ID || DESCOPE_PROJECT_ID,
        issuer: oidcIssuer(),
        scope: "openid profile email",
      },
    });
  }
  return sdk;
}
