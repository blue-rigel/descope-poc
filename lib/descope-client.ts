"use client";

import createSdk, { getSessionToken } from "@descope/web-js-sdk";

import {
  DESCOPE_APP_ID,
  DESCOPE_BASE_URL,
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
