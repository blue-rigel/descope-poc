"use client";

import { getDescope } from "@/lib/descope-client";
import {
  DESCOPE_APP_ID,
  DESCOPE_BASE_URL,
  DESCOPE_CLIENT_ID,
} from "@/lib/descope-config";
import { markHandoffStarted, type ClientConfig } from "@/lib/native-config";

/**
 * Session hand-off to the native app (the counterpart of the legacy
 * `renewTokenAfterProfileUpdate` → `authWithRedirect`, see
 * `docs/non-web-platform-flow.md` §5).
 *
 * The webview never owns the app's long-lived tokens: it authenticates the
 * user, then asks the IdP for a *fresh authorization code* delivered straight
 * to the app's deep link, and drops its own tokens on the way out.
 */

/** Descope Inbound (OIDC) Application authorization endpoint. */
const AUTHORIZE_PATH = "/oauth2/v1/apps/authorize";
const PKCE_KEY = "mysph-native-pkce";
const DEFAULT_SCOPE = "openid profile email offline_access";

/** Descope's default session / refresh token keys. */
const TOKEN_KEYS = ["DS", "DSR"];

type NativePkce = {
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  scope?: string;
};

/**
 * PKCE is owned by the **native app**: it generates the verifier, sends us only
 * the challenge, and exchanges the deep-linked code itself. The webview must
 * never see the verifier, so we just carry the challenge across the hops.
 */
export function storeNativePkce(params: URLSearchParams) {
  const codeChallenge = params.get("codeChallenge")?.trim();
  if (!codeChallenge) return;

  const pkce: NativePkce = {
    codeChallenge,
    codeChallengeMethod: params.get("codeChallengeMethod")?.trim() || "S256",
    state: params.get("state")?.trim() || undefined,
    scope: params.get("scope")?.trim() || undefined,
  };
  window.sessionStorage.setItem(PKCE_KEY, JSON.stringify(pkce));
}

function readNativePkce(): NativePkce | null {
  try {
    const raw = window.sessionStorage.getItem(PKCE_KEY);
    return raw ? (JSON.parse(raw) as NativePkce) : null;
  } catch {
    return null;
  }
}

function apiBaseUrl() {
  return DESCOPE_BASE_URL?.replace(/\/$/, "") ?? "https://api.descope.com";
}

/**
 * Drop the webview's own tokens.
 *
 * Deliberately NOT `sdk.logout()`: that revokes the refresh token and ends the
 * IdP session, and the hand-off below depends on that session still being live
 * for its `prompt=none` authorization. Legacy had the same split — it revoked
 * the temporary social-flow app's tokens only, never the Okta session.
 */
export function clearWebviewTokens() {
  for (const key of TOKEN_KEYS) {
    window.localStorage.removeItem(key);
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
  }
}

/**
 * Pre-launch cleanup for a native webview (legacy `initiateLogin` pre-work):
 * a stale session left behind by a previous run interferes with the new one, so
 * revoke it and start clean. Best-effort — failures must not block the launch.
 */
export async function prepareNativeLaunch() {
  try {
    await getDescope().logout();
  } catch {
    // No session to end, or the network is unavailable — continue either way.
  }
  clearWebviewTokens();
}

/**
 * Build the authorization request whose `code` lands on the app's deep link.
 * `prompt=none` because the user has just authenticated in this webview.
 */
export function buildNativeAuthorizeUrl(config: ClientConfig) {
  const clientId = config.clientId || DESCOPE_APP_ID || DESCOPE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "No inbound-app client id: set NEXT_PUBLIC_APP_ID or clientId in the client config",
    );
  }

  const pkce = readNativePkce();
  const url = new URL(`${apiBaseUrl()}${AUTHORIZE_PATH}`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", config.redirectUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", pkce?.scope || DEFAULT_SCOPE);
  url.searchParams.set("prompt", "none");
  if (pkce?.state) url.searchParams.set("state", pkce.state);
  if (pkce) {
    url.searchParams.set("code_challenge", pkce.codeChallenge);
    url.searchParams.set("code_challenge_method", pkce.codeChallengeMethod);
  }
  return url.toString();
}

/**
 * Final hop: mint a fresh code for the app and leave the webview.
 * The app exchanges it at `{apiBase}/oauth2/v1/apps/token` for its own tokens.
 */
export function handOffToNativeApp(config: ClientConfig) {
  const authorizeUrl = buildNativeAuthorizeUrl(config);
  markHandoffStarted();
  clearWebviewTokens();
  window.location.assign(authorizeUrl);
}
