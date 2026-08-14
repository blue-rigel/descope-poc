"use client";

import createSdk, { getSessionToken } from "@descope/web-js-sdk";

import {
  DESCOPE_BASE_URL,
  DESCOPE_CLIENT_ID,
  DESCOPE_PROJECT_ID,
  oidcIssuer,
} from "./descope-config";

/** Current session JWT (from the `DS` cookie/storage), or "" if none. */
export function getToken() {
  return getSessionToken();
}

/**
 * Browser Descope SDK singleton.
 *
 * - `persistTokens` keeps tokens in browser storage and enables getSessionToken().
 * - `sessionTokenViaCookie` also writes the session token to the `DS` cookie so
 *   the server-side proxy middleware can read and validate it.
 * - `autoRefresh` keeps the session token fresh in the background.
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
        // The Descope OIDC application's client ID (falls back to project ID).
        clientId: DESCOPE_CLIENT_ID || DESCOPE_PROJECT_ID,
        applicationId: DESCOPE_CLIENT_ID || DESCOPE_PROJECT_ID,
        issuer: oidcIssuer(),
        scope: "openid profile email",
      },
    });
  }
  return sdk;
}
