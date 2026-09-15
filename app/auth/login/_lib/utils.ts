import { SCREEN_MAGIC_LINK_SENT, SCREEN_WELCOME } from "./constants";
import type { DescopeError } from "./types";

export function isCustomScreen(name: string) {
  return [SCREEN_WELCOME, SCREEN_MAGIC_LINK_SENT].includes(name);
}

export function getErrorMessage(value: unknown, fallback = "Authentication failed") {
  if (!value || typeof value !== "object") return fallback;
  const error = value as DescopeError;
  return error.errorMessage || error.errorDescription || fallback;
}
