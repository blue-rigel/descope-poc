import "server-only";

import DescopeClient from "@descope/node-sdk";

import { DESCOPE_PROJECT_ID } from "./descope-config";

/**
 * ⚠️ SECURITY: this is the Descope MANAGEMENT KEY — a server secret.
 * It is currently stored as NEXT_PUBLIC_API_KEY, which means Next.js would
 * inline it into the client bundle if it were ever imported from client code.
 * This module is marked `server-only`, so importing it from a Client Component
 * is a build-time error — keeping the key off the browser.
 *
 * TODO: rename the env var to DESCOPE_API_KEY (non-public) so the value is never
 * available to the client bundler at all.
 */
const MANAGEMENT_KEY = process.env.NEXT_PUBLIC_API_KEY;

let client: ReturnType<typeof DescopeClient> | undefined;

/** Memoized node-sdk client (validation + management API). */
export function getDescopeServer() {
  if (!client) {
    client = DescopeClient({
      projectId: DESCOPE_PROJECT_ID,
      managementKey: MANAGEMENT_KEY,
    });
  }
  return client;
}

/**
 * Validate a session JWT taken from the `DS` cookie (or an Authorization
 * header). Returns the decoded auth info on success, or `null` if the token is
 * missing, malformed, or expired.
 */
export async function validateDescopeSession(
  sessionJwt: string | undefined,
  options?: { logError?: boolean },
) {
  if (!sessionJwt) return null;
  try {
    return await getDescopeServer().validateSession(sessionJwt);
  } catch (error) {
    if (options?.logError) {
      console.error("Descope session validation failed", error);
    }
    return null;
  }
}
