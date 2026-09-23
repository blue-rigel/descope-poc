"use client";

import { getDescope } from "@/lib/descope-client";
import {
  DESCOPE_APP_ID,
  DESCOPE_CLIENT_ID,
  DESCOPE_IDP_BASE_URL,
  MAGW_MOBILE_APP_ID,
  MAGW_MOBILE_CLIENT_ID,
  absoluteUrl,
} from "@/lib/descope-config";
import {
  markHandoffStarted,
  NATIVE_CALLBACK_PATH,
  type ClientConfig,
} from "@/lib/native-config";

/**
 * Session hand-off to the native app.
 *
 * The iOS / Android apps run **no authentication flow of their own** — they open
 * this web interface in a webview and wait for the result. So the webview does
 * all of the OAuth work: it authenticates the user with the login form, mints an
 * authorization code for the Federated App client (MAGW_Mobile_App), and
 * deep-links back with the code *and* the PKCE verifier it generated. The app's
 * only job is one token call.
 *
 *   /native/login   web login form (password / email OTP / social)
 *   /native/handoff authorize with webview-generated PKCE
 *   /native/callback code lands here → deep link: ?code=…&code_verifier=…
 *   app             POST {idpBase}/{appId}/oauth2/v1/token → its own tokens
 *
 * Note the trade-off this shape accepts: shipping the verifier next to the code
 * means PKCE no longer binds the exchange to the requesting client — it is a
 * transport detail, not a proof of possession. The deep link is the trust
 * boundary, so the scheme must be claimed by the app (App Links / Universal
 * Links) rather than a plain custom scheme any app can register.
 */

/**
 * Federated OIDC App authorization endpoint from MAGW_Mobile_App discovery:
 * `{idpBase}/{ssoAppId}/oauth2/v1/authorize`
 */
function authorizePath(appId = MAGW_MOBILE_APP_ID) {
  return `/${appId}/oauth2/v1/authorize`;
}

const PKCE_KEY = "mysph-webview-pkce";
const SILENT_KEY = "mysph-native-silent-authorize";
const LAUNCH_KEY = "mysph-app-launch-params";
const DEFAULT_SCOPE = "openid profile email offline_access";

/** Descope's default session / refresh token keys. */
const TOKEN_KEYS = ["DS", "DSR"];

type WebviewPkce = {
  verifier: string;
  state: string;
};

/** What the app asked for at launch time and wants echoed back to it. */
type AppLaunchParams = {
  /** The app's own state value, returned untouched on the deep link. */
  state?: string;
  /** Scope override for the code the app will exchange. */
  scope?: string;
};

export function storeAppLaunchParams(params: URLSearchParams) {
  const launch: AppLaunchParams = {
    state: params.get("state")?.trim() || undefined,
    scope: params.get("scope")?.trim() || undefined,
  };
  window.sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(launch));
}

function readAppLaunchParams(): AppLaunchParams {
  try {
    const raw = window.sessionStorage.getItem(LAUNCH_KEY);
    return raw ? (JSON.parse(raw) as AppLaunchParams) : {};
  } catch {
    return {};
  }
}

function randomUrlSafeString(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE pair generated in the webview, since the app has no auth code of its own. */
async function createPkcePair() {
  const verifier = randomUrlSafeString(32);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

function readWebviewPkce(): WebviewPkce | null {
  try {
    const raw = window.sessionStorage.getItem(PKCE_KEY);
    return raw ? (JSON.parse(raw) as WebviewPkce) : null;
  } catch {
    return null;
  }
}

function apiBaseUrl() {
  return DESCOPE_IDP_BASE_URL;
}

function resolveClientId(config: ClientConfig) {
  const clientId =
    config.clientId ||
    DESCOPE_CLIENT_ID ||
    DESCOPE_APP_ID ||
    MAGW_MOBILE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "No Federated App client id: set NEXT_PUBLIC_CLIENT_ID or clientId in the client config",
    );
  }
  return clientId;
}

/**
 * Drop the webview's own tokens.
 *
 * Deliberately NOT `sdk.logout()`: that revokes the refresh token and ends the
 * session the authorization request depends on. This only clears what this
 * origin holds, so the webview stops being a second live session once the app
 * has its code.
 */
export function clearWebviewTokens() {
  for (const key of TOKEN_KEYS) {
    window.localStorage.removeItem(key);
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
  }
}

/**
 * Pre-launch cleanup for a native webview: a session left behind by a previous
 * run would silently authorize the wrong user, so revoke it and start clean.
 * Best-effort — failures must not block the login form.
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
 * Build the authorization request. `redirect_uri` is this webview's own
 * callback, not the app's deep link: the webview needs to see the code so it
 * can deliver the matching verifier with it.
 *
 * @param interactive re-prompt in the webview. The default `prompt=none` reuses
 *   the session the login form just established; when the IdP cookie is not
 *   readable in the webview it answers `login_required`, and the callback
 *   retries interactively — which renders Descope's own hosted login here.
 */
export async function buildAuthorizeUrl(
  config: ClientConfig,
  interactive = false,
) {
  const { verifier, challenge } = await createPkcePair();
  const state = randomUrlSafeString(16);
  const launch = readAppLaunchParams();

  const pkce: WebviewPkce = { verifier, state };
  window.sessionStorage.setItem(PKCE_KEY, JSON.stringify(pkce));

  const url = new URL(`${apiBaseUrl()}${authorizePath()}`);
  url.searchParams.set("client_id", resolveClientId(config));
  // Code lands on this webview first so we can attach the PKCE verifier before
  // forwarding to the app's redirectUrl (e.g. /native/auth-code for testing).
  url.searchParams.set("redirect_uri", absoluteUrl(NATIVE_CALLBACK_PATH));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", launch.scope || DEFAULT_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (!interactive) url.searchParams.set("prompt", "none");
  return url.toString();
}

/**
 * Record whether the session this webview just created is one the IdP will
 * recognise on its own.
 *
 * Only the login form knows this. A top-level navigation to the IdP (social
 * sign-in) leaves a session cookie there, so `prompt=none` can reuse it. A
 * password or one-time-code sign-in is a background API call from this origin,
 * and the webview usually cannot present that cookie back — the silent request
 * would spend a round trip only to answer `login_required`. In that case the
 * form drops `prompt=none` and the authorization goes straight to interactive.
 */
export function setSilentAuthorization(allowed: boolean) {
  window.sessionStorage.setItem(SILENT_KEY, allowed ? "1" : "0");
}

function isSilentAuthorizationAllowed() {
  return window.sessionStorage.getItem(SILENT_KEY) !== "0";
}

/**
 * Start the authorization hop. Leaves this page.
 *
 * `interactive` defaults to whatever the login form recorded; pass it
 * explicitly to force one or the other (the callback's retry does).
 */
export async function startNativeAuthorization(
  config: ClientConfig,
  interactive = !isSilentAuthorizationAllowed(),
) {
  const authorizeUrl = await buildAuthorizeUrl(config, interactive);
  markHandoffStarted();
  window.location.assign(authorizeUrl);
}

/**
 * Turn the code this webview just received into the app's deep link.
 * Throws when the `state` does not match the one we sent.
 */
export function buildDeepLinkUrl(config: ClientConfig, params: URLSearchParams) {
  const code = params.get("code");
  const state = params.get("state");
  const pkce = readWebviewPkce();

  if (!code) throw new Error("Authorization response carried no code");
  if (!pkce) throw new Error("No pending authorization in this webview");
  if (state !== pkce.state) throw new Error("Authorization state mismatch");

  const launch = readAppLaunchParams();
  const url = new URL(config.redirectUrl);
  url.searchParams.set("code", code);
  url.searchParams.set("code_verifier", pkce.verifier);
  if (launch.state) url.searchParams.set("state", launch.state);
  return url.toString();
}

/**
 * Final hop: leave the webview for the app, which exchanges the code at
 * `{idpBase}/{appId}/oauth2/v1/token` using the verifier we just handed it.
 */
export function handOffToNativeApp(config: ClientConfig, params: URLSearchParams) {
  const deepLink = buildDeepLinkUrl(config, params);
  window.sessionStorage.removeItem(PKCE_KEY);
  clearWebviewTokens();
  window.location.assign(deepLink);
}

/** Report a failed authorization to the app rather than stranding the webview. */
export function reportFailureToNativeApp(config: ClientConfig, error: string) {
  const launch = readAppLaunchParams();
  const url = new URL(config.redirectUrl);
  url.searchParams.set("error", error);
  if (launch.state) url.searchParams.set("state", launch.state);
  clearWebviewTokens();
  window.location.assign(url.toString());
}
