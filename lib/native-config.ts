"use client";

/**
 * Non-web (native iOS / Android) platform support.
 *
 * Mirrors the legacy MySPH standalone host (see `docs/ARCHITECTURE.md` and
 * `docs/non-web-platform-flow.md`): a native app opens this SPA in a webview,
 * passes device context as query params, and expects the finished session to be
 * handed back as an OAuth authorization `code` on its own deep link.
 *
 * The apps themselves run no authentication flow — every screen the user sees
 * is this web interface, rendered inside their webview.
 *
 * This module owns the three things that must survive the redirect hops:
 * the publisher `ClientConfig`, the captured `MobileParameters`, and the
 * "redirect in flight" flag.
 */

export type Platform = "web" | "ios" | "android";

/** Publisher configuration — the counterpart of the legacy `clientConfig.json`. */
export type ClientConfig = {
  pubId: string;
  platform: Platform;
  /** Native app deep link that receives the final authorization `code`. */
  redirectUrl: string;
  /** Inbound-app client id override; defaults to NEXT_PUBLIC_APP_ID. */
  clientId?: string;
  language?: string;
  providers?: string[];
};

/** Device context an app passes on the webview URL. All but platform/pubId optional. */
export type MobileParameters = {
  platform: Platform;
  pubId: string;
  deviceId?: string;
  osVersion?: string;
  appVersion?: string;
};

const CLIENT_CONFIG_KEY = "mysph-client-config";
const MOBILE_PARAMS_KEY = "mysph-mobile-parameters";
const HANDOFF_KEY = "mysph-native-handoff";
const HANDOFF_TTL_MS = 2 * 60 * 1000;

/** CDN origin serving `<base>/config/<pubId>/clientConfig.json`. */
export const STATIC_BASE_URL =
  process.env.NEXT_PUBLIC_STATIC_BASE_URL?.replace(/\/$/, "") ?? "";

export const NATIVE_LOGIN_PATH = "/native/login";
export const NATIVE_HANDOFF_PATH = "/native/handoff";
export const NATIVE_CALLBACK_PATH = "/native/callback";

export function isNativePlatform(platform: Platform | undefined) {
  return platform === "ios" || platform === "android";
}

function asPlatform(value: string | null): Platform | undefined {
  return value === "web" || value === "ios" || value === "android"
    ? value
    : undefined;
}

/** Deep links are custom-scheme URLs (`myapp://…`) — reject anything unparseable. */
function isValidRedirectUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a publisher config from the static origin, keyed by `pubId`.
 * Parse failures are re-thrown with `{ cause }` so the caller can surface them.
 */
export async function loadClientConfig(pubId: string): Promise<ClientConfig> {
  if (!STATIC_BASE_URL) {
    throw new Error("NEXT_PUBLIC_STATIC_BASE_URL is not configured");
  }

  const url = `${STATIC_BASE_URL}/config/${pubId}/clientConfig.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load client config for "${pubId}" (${response.status})`);
  }

  try {
    return (await response.json()) as ClientConfig;
  } catch (cause) {
    throw new Error(`Malformed client config for "${pubId}"`, { cause });
  }
}

export function storeClientConfig(config: ClientConfig) {
  window.localStorage.setItem(CLIENT_CONFIG_KEY, JSON.stringify(config));
}

export function readClientConfig(): ClientConfig | null {
  try {
    const raw = window.localStorage.getItem(CLIENT_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as ClientConfig) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the config for this launch, in the legacy precedence order:
 *
 * 1. query params (`platform` + `redirectUrl`) — how legacy LB1 apps supplied
 *    their deep link, and the only source that needs no CDN;
 * 2. the static origin, by `pubId`;
 * 3. the previously stored config (we are mid-flow, after a redirect).
 *
 * The result is persisted so the handoff route can read it after the IdP hops.
 */
export async function resolveClientConfig(
  params: URLSearchParams,
): Promise<ClientConfig> {
  const pubId = params.get("pubId")?.trim() ?? "";
  const platform = asPlatform(params.get("platform"));
  const redirectUrl = params.get("redirectUrl")?.trim();

  if (pubId && platform && isValidRedirectUrl(redirectUrl)) {
    const config: ClientConfig = { pubId, platform, redirectUrl };
    storeClientConfig(config);
    return config;
  }

  if (pubId && STATIC_BASE_URL) {
    const config = await loadClientConfig(pubId);
    // A `redirectUrl` query param still wins — legacy deep-link override.
    const resolved: ClientConfig = {
      ...config,
      pubId,
      platform: platform ?? config.platform ?? "web",
      redirectUrl: isValidRedirectUrl(redirectUrl)
        ? redirectUrl
        : config.redirectUrl,
    };
    storeClientConfig(resolved);
    return resolved;
  }

  const stored = readClientConfig();
  if (stored) return stored;

  throw new Error(
    "No client config: pass pubId with platform + redirectUrl, or configure NEXT_PUBLIC_STATIC_BASE_URL",
  );
}

/** Capture device context off the webview URL. Missing values stay undefined. */
export function captureMobileParameters(
  params: URLSearchParams,
  config: ClientConfig,
): MobileParameters {
  const mobileParameters: MobileParameters = {
    platform: config.platform,
    pubId: config.pubId,
    deviceId: params.get("deviceId") ?? undefined,
    osVersion: params.get("osVersion") ?? undefined,
    appVersion: params.get("appVersion") ?? undefined,
  };

  window.sessionStorage.setItem(
    MOBILE_PARAMS_KEY,
    JSON.stringify(mobileParameters),
  );
  return mobileParameters;
}

export function readMobileParameters(): MobileParameters | null {
  try {
    const raw = window.sessionStorage.getItem(MOBILE_PARAMS_KEY);
    return raw ? (JSON.parse(raw) as MobileParameters) : null;
  } catch {
    return null;
  }
}

/**
 * "Redirect in flight" guard. The handoff navigates the webview to the IdP and
 * then to the app deep link; if the webview bounces back through `/native/login`
 * in the meantime, the host must render nothing rather than restart the flow.
 */
export function markHandoffStarted() {
  window.sessionStorage.setItem(HANDOFF_KEY, String(Date.now()));
}

export function clearHandoff() {
  window.sessionStorage.removeItem(HANDOFF_KEY);
}

export function isHandoffInFlight() {
  const startedAt = Number(window.sessionStorage.getItem(HANDOFF_KEY));
  if (!startedAt) return false;

  // A hand-off that never left the webview (deep link not registered, IdP
  // error) must not block the host forever — expire the guard.
  if (Date.now() - startedAt > HANDOFF_TTL_MS) {
    clearHandoff();
    return false;
  }
  return true;
}
