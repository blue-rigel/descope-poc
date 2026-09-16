import type { FormEvent } from "react";
import type { default as DescopeWebComponent } from "@descope/web-component";

export type DescopeElement = InstanceType<typeof DescopeWebComponent>;
export type ScreenUpdate = NonNullable<DescopeElement["onScreenUpdate"]>;
export type ScreenContext = Parameters<ScreenUpdate>[1];

/**
 * Advances the active Descope Flow. The first argument is the `action` to
 * perform on the current screen (see `ACTION_*` in `constants.ts`) — it must
 * match an action the Flow is configured to handle on that screen. The
 * second argument carries any form data the action needs (e.g. email).
 */
export type PerformAction = Parameters<ScreenUpdate>[2];

export type CustomScreen = {
  name: string;
  context: ScreenContext;
  next: PerformAction;
  host: DescopeElement;
};

export type DescopeError = {
  errorCode?: string;
  errorDescription?: string;
  errorMessage?: string;
};

export type UiOption = "minimal" | "editorial" | "workspace";

/** Shared props for each visual variant of the welcome / magic-link screens. */
export type ScreenProps = {
  screenName: string | undefined;
  sentTo: string;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  submitting: boolean;
  error: string | null;
  cooldown: number;
  uiOption: UiOption;
  onUiOptionChange: (option: UiOption) => void;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignUpSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEmailAction: () => void;
  onGoogleAction: () => void;
  onResend: () => void;
  onBack: () => void;
};

