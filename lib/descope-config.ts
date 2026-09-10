/**
 * Shared Descope configuration used on both client and server.
 * Only NEXT_PUBLIC_PROJECT_ID is safe to read here (it is public by design).
 * The management key (API key) must NEVER be imported into this module — it is
 * server-only and lives in lib/descope-server.ts.
 */

export const DESCOPE_PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? "";

/**
 * The Descope Inbound (OIDC) Application ID. This is what the web-js OIDC flow
 * uses as `applicationId` for the SSO hosted-login redirect — NOT the raw
 * client ID. The client secret is never read: the browser Authorization-Code +
 * PKCE flow does not use it.
 */
export const DESCOPE_APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? "";

/**
 * The inbound OIDC application's client ID. oidc-client-ts requires this
 * whenever a custom `issuer` is supplied. The matching client SECRET is never
 * read (browser Authorization-Code + PKCE flow does not use it).
 */
export const DESCOPE_CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? "";
/**
 * Optional custom base URL (e.g. a CNAME'd auth domain). Falls back to Descope's
 * shared hosted domain. Override with NEXT_PUBLIC_DESCOPE_BASE_URL if needed.
 */
export const DESCOPE_BASE_URL =
  process.env.NEXT_PUBLIC_DESCOPE_BASE_URL ?? undefined;

/** Flow executed by the custom web-js SDK runner. */
export const DESCOPE_FLOW_ID = process.env.NEXT_PUBLIC_DESCOPE_FLOW_ID?.trim() ?? "";

/** Where a successful login should land the user. */
export const POST_LOGIN_PATH = "/me";

/** Where an unauthenticated user is sent to sign in. */
export const LOGIN_PATH = "/auth/login";

/** Restrict post-authentication navigation to a path on this application. */
export function safeReturnPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return POST_LOGIN_PATH;
  }

  try {
    const base = new URL("https://app.invalid");
    const url = new URL(value, base);

    if (url.origin !== base.origin) return POST_LOGIN_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return POST_LOGIN_PATH;
  }
}

/**
 * Descope's hosted login/flow page. Renders the project's flow UI on Descope's
 * domain. After the flow completes it redirects back to `redirectUrl`, setting
 * the session cookie on the way.
 *
 * @param redirectUrl absolute URL to return to after login
 * @param flowId      the flow to run (defaults to the sign-up-or-in flow)
 */
export function hostedLoginUrl(redirectUrl: string, flowId = "sign-up-or-in") {
  const base =
    DESCOPE_BASE_URL?.replace(/\/$/, "") ?? "https://auth.descope.io";
  const url = new URL(`${base}/${DESCOPE_PROJECT_ID}`);
  url.searchParams.set("flow", flowId);
  url.searchParams.set("redirect-url", redirectUrl);
  return url.toString();
}

/**
 * OIDC issuer for this Descope project. Descope exposes each project as an OIDC
 * provider at `<apiBaseUrl>/<projectId>`. The clientId defaults to the project
 * ID. Used by sdk.oidc.loginWithRedirect / finishLoginIfNeed.
 */
export function oidcIssuer() {
  const apiBase =
    DESCOPE_BASE_URL?.replace(/\/$/, "") ?? "https://api.descope.com";
  return `${apiBase}/${DESCOPE_PROJECT_ID}`;
}

/** Build an absolute URL for `path` on the current origin (browser only). */
export function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}
