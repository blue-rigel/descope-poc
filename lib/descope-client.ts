"use client";

import createSdk, { getSessionToken } from "@descope/web-js-sdk";

import {
  DESCOPE_APP_ID,
  DESCOPE_BASE_URL,
  DESCOPE_PROJECT_ID,
} from "./descope-config";

/** Descope's default refresh-token cookie / localStorage key. */
const REFRESH_KEY = "DSR";
const OIDC_STORAGE_PREFIX = "oidc_";

/** Current session JWT (from the `DS` cookie/storage), or "" if none. */
export function getToken() {
  return getSessionToken();
}

/** Current OIDC application session token, isolated from native auth. */
export function getOidcSessionToken() {
  return (getDescopeOidc() as ReturnType<typeof createSdk<true>>).getSessionToken();
}

/** Current OIDC refresh token, isolated from native auth. */
export function getOidcRefreshToken() {
  return (getDescopeOidc() as ReturnType<typeof createSdk<true>>).getRefreshToken();
}

/** Current OIDC application ID token, or "" if none. */
export function getOidcIdToken() {
  return (getDescopeOidc() as ReturnType<typeof createSdk<true>>).getIdToken();
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
let oidcSdk: ReturnType<typeof createSdk> | undefined;
let initialSessionRefresh: Promise<boolean> | undefined;

export function getDescope() {
  if (!sdk) {
    sdk = createSdk({
      projectId: DESCOPE_PROJECT_ID,
      baseUrl: DESCOPE_BASE_URL,
      persistTokens: true as const,
      // Write the session token to the `DS` cookie so the server-side proxy can
      // validate it. `secure` must be false over plain HTTP (local dev) or the
      // browser silently drops the cookie and every session check fails.
      sessionTokenViaCookie: {
        secure: process.env.NODE_ENV !== "development",
      },
      autoRefresh: true,
    });
  }
  return sdk;
}

/** OIDC-specific SDK used only by the hosted SSO flow. */
export function getDescopeOidc() {
  if (!oidcSdk) {
    oidcSdk = createSdk({
      projectId: DESCOPE_PROJECT_ID,
      baseUrl: DESCOPE_BASE_URL,
      persistTokens: true as const,
      storagePrefix: OIDC_STORAGE_PREFIX,
      autoRefresh: true,
      oidcConfig: {
        // Descope Inbound (OIDC) Application ID drives the hosted-login flow.
        // For this inbound app the app ID is ALSO the OIDC client_id — using the
        // long CLIENT_ID value here breaks the login-page redirect.
        applicationId: DESCOPE_APP_ID,
        // clientId: DESCOPE_PROJECT_ID,
        // issuer: oidcIssuer(),
        scope: "openid profile email offline_access",
      },
      // oidcConfig: true
    });
  }

  return oidcSdk;
}

/** Clear this application's local session without ending the shared OIDC SSO session. */
export async function logoutOidcApplicationSession() {
  const idToken = getOidcIdToken();

  // Build the sign-out request only. The SDK clears its OIDC state, tokens,
  // notifications, and refresh timers, but does not visit the end-session URL
  // or revoke the shared Descope session.
  await getDescopeOidc().oidc.logout(
    idToken ? { id_token_hint: idToken } : undefined,
    true,
  );
}

/** Refresh the isolated OIDC application session. */
export async function forceRefreshOidcSession() {
  const descope = getDescopeOidc();
  const refreshToken = getOidcRefreshToken();

  if (!refreshToken) {
    throw new Error("No OIDC refresh token is available");
  }

  const result = await descope.refresh(refreshToken);
  const sessionToken = getOidcSessionToken();

  if (!result.ok || !sessionToken || descope.isJwtExpired(sessionToken)) {
    throw new Error(
      result.error?.errorMessage ||
      result.error?.errorDescription ||
      "Could not refresh OIDC session",
    );
  }

  return sessionToken;
}

/** Refresh immediately, bypassing the one-time initialization promise. */
export async function forceRefreshSession() {
  const result = await getDescope().refresh();
  const sessionJwt = result.data?.sessionJwt || getToken();

  if (!result.ok || !sessionJwt) {
    throw new Error(
      result.error?.errorMessage ||
      result.error?.errorDescription ||
      "Could not refresh session",
    );
  }

  return sessionJwt;
}

/** Restore or refresh the browser session through the Descope SDK. */
export function initializeSessionRefresh() {
  const descope = getDescope();

  if (!initialSessionRefresh) {
    initialSessionRefresh = (async () => {
      const currentToken = getToken();

      // Reuse a valid session token. Only restore from DSR when the access token
      // is absent or expired.
      if (currentToken && !descope.isJwtExpired(currentToken)) {
        return true;
      }

      try {
        await forceRefreshSession();
      } catch {
        return false;
      }

      return true;
    })().catch(() => false);
  }

  return initialSessionRefresh;
}
