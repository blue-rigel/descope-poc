import type { UiOption } from "./types";

// These names and action IDs must match the active Descope Flow exactly.
export const SCREEN_WELCOME = "welcome-screen";
export const SCREEN_MAGIC_LINK_SENT = "magic-link-sent";

/**
 * Actions are the "verbs" a screen can perform next — each one is passed as
 * the first argument to a screen's `next()` call to tell the Descope Flow
 * which step to take (e.g. continue with email, resend the link, go back).
 */
export const ACTION_EMAIL = "continue-with-email";
export const ACTION_PASSWORD = "continue-with-password";
export const ACTION_GOOGLE = "continue-with-google";
export const ACTION_RESEND = "resend";
export const ACTION_BACK = "EbW8KMdjAx";
export const ACTION_POLLING = "polling";

export const RESEND_COOLDOWN_SECONDS = 60;

export const UI_OPTIONS: Array<{ id: UiOption; label: string }> = [
  { id: "minimal", label: "Minimal" },
  { id: "editorial", label: "Editorial" },
  { id: "workspace", label: "Workspace" },
];
