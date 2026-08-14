/**
 * Shared Descope configuration used on both client and server.
 * Only NEXT_PUBLIC_PROJECT_ID is safe to read here (it is public by design).
 * The management key (API key) must NEVER be imported into this module — it is
 * server-only and lives in lib/descope-server.ts.
 */

export const DESCOPE_PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? "";

/**
 * OIDC application client ID (from the Descope "Applications" / inbound OIDC
 * app). Used for the SSO hosted-login redirect flow. The matching client SECRET
 * is intentionally NOT read anywhere: the browser Authorization-Code + PKCE
 * flow never uses it, so it must stay server-only (and ideally be renamed off
 * the NEXT_PUBLIC_ prefix).
 */
export const DESCOPE_CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? "";

/**
 * Optional custom base URL (e.g. a CNAME'd auth domain). Falls back to Descope's
 * shared hosted domain. Override with NEXT_PUBLIC_DESCOPE_BASE_URL if needed.
 */
export const DESCOPE_BASE_URL =
  process.env.NEXT_PUBLIC_DESCOPE_BASE_URL ?? undefined;

/** Where a successful login should land the user. */
export const POST_LOGIN_PATH = "/auth/settings";

/** Where an unauthenticated user is sent to sign in. */
export const LOGIN_PATH = "/login-native";

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
