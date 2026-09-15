import {
  type FormEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { getDescope, initializeSessionRefresh } from "@/lib/descope-client";
import {
  DESCOPE_BASE_URL,
  DESCOPE_FLOW_ID,
  DESCOPE_PROJECT_ID,
  POST_LOGIN_PATH,
  safeReturnPath,
} from "@/lib/descope-config";

import {
  ACTION_BACK,
  ACTION_EMAIL,
  ACTION_GOOGLE,
  ACTION_PASSWORD,
  ACTION_POLLING,
  ACTION_RESEND,
  RESEND_COOLDOWN_SECONDS,
  SCREEN_MAGIC_LINK_SENT,
  UI_OPTIONS,
} from "../_lib/constants";
import type {
  CustomScreen,
  DescopeElement,
  DescopeError,
  ScreenContext,
  PerformAction,
  UiOption,
} from "../_lib/types";
import { getErrorMessage, isCustomScreen } from "../_lib/utils";

/**
 * Owns the Descope web component lifecycle and all of the state/actions the
 * BYOS login UI needs. Screens only render what this hook gives them and
 * call back with the `action` the user chose (see `ACTION_*` constants).
 *
 * The mount node is passed in (rather than returned) so the ref stays a
 * plain `useRef` value owned by the page, not a field on this hook's
 * returned object.
 */
export function useLoginFlow(mountRef: RefObject<HTMLDivElement | null>) {
  const destinationRef = useRef(POST_LOGIN_PATH);
  const pendingOidcAuthorizationRef = useRef(false);
  const pollingStepRef = useRef("");
  const pollingKickoffRef = useRef<number | null>(null);

  const [screen, setScreen] = useState<CustomScreen | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [uiOption, setUiOption] = useState<UiOption>("minimal");

  const flowError = screen?.context.error?.text || null;
  const error = localError || flowError;

  const onScreenUpdate = useEffectEvent(
    (
      name: string,
      context: ScreenContext,
      next: PerformAction,
      host: DescopeElement,
    ) => {
      setInitializing(false);
      setSubmitting(false);
      setLocalError(null);

      if (!isCustomScreen(name)) {
        setFatalError(`Unsupported Flow screen: ${name || "unnamed"}`);
        setScreen(null);
        // Keep unknown Descope screens hidden instead of silently falling back
        // to a different UI from the custom BYOS experience.
        return true;
      }

      if (name === SCREEN_MAGIC_LINK_SENT) {
        const { executionId, stepId } = host.flowState.current;
        const pollingStep = `${executionId}:${stepId}`;

        if (pollingStepRef.current !== pollingStep) {
          pollingStepRef.current = pollingStep;
          setCooldown(RESEND_COOLDOWN_SECONDS);

          // A built-in polling loader normally sends this first action.
          // BYOS hides that loader, so start it once; the web component then
          // owns the recurring two-second polling loop.
          if (context.action !== "poll") {
            pollingKickoffRef.current = window.setTimeout(() => {
              pollingKickoffRef.current = null;
              void next(ACTION_POLLING, {}).catch((cause) => {
                setLocalError(
                  getErrorMessage(cause, "Could not check the sign-in link"),
                );
              });
            }, 0);
          }
        }
      } else {
        pollingStepRef.current = "";
      }

      setScreen({ name, context, next, host });
      return true;
    },
  );

  const onSuccess = useEffectEvent(async (event: Event) => {
    const redirectUrl = (
      event as CustomEvent<{
        flowOutput?: { onSuccessRedirectUrl?: unknown };
      }>
    ).detail?.flowOutput?.onSuccessRedirectUrl;

    try {
      await getDescope().refresh();
    } finally {
      if (typeof redirectUrl === "string" && redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      if (pendingOidcAuthorizationRef.current) {
        setSubmitting(false);
        setFatalError("Could not complete SSO authorization.");
        return;
      }

      window.location.replace(destinationRef.current);
    }
  });

  const onError = useEffectEvent((event: Event) => {
    setSubmitting(false);
    setFatalError(getErrorMessage((event as CustomEvent<DescopeError>).detail));
  });

  useEffect(() => {
    let cancelled = false;
    let element: DescopeElement | null = null;

    async function initialize() {
      const requestUrl = new URL(window.location.href);
      const requestedUi = requestUrl.searchParams.get("ui");
      const hasPendingOidcAuthorization =
        requestUrl.searchParams.has("sso_app_id") &&
        requestUrl.searchParams.has("state_id");
      pendingOidcAuthorizationRef.current = hasPendingOidcAuthorization;

      if (UI_OPTIONS.some(({ id }) => id === requestedUi)) {
        setUiOption(requestedUi as UiOption);
      }

      destinationRef.current = safeReturnPath(
        requestUrl.searchParams.get("from"),
      );

      const authenticated = hasPendingOidcAuthorization
        ? false
        : await initializeSessionRefresh();
      if (authenticated && !hasPendingOidcAuthorization) {
        window.location.replace(destinationRef.current);
        return;
      }

      if (!DESCOPE_PROJECT_ID || !DESCOPE_FLOW_ID) {
        setFatalError(
          "NEXT_PUBLIC_PROJECT_ID and NEXT_PUBLIC_DESCOPE_FLOW_ID must be configured.",
        );
        setInitializing(false);
        return;
      }

      const { default: DescopeWc } = await import("@descope/web-component");
      if (cancelled || !mountRef.current) return;

      element = new DescopeWc();
      element.setAttribute("project-id", DESCOPE_PROJECT_ID);
      element.setAttribute("flow-id", DESCOPE_FLOW_ID);
      element.setAttribute("redirect-url", window.location.href);
      element.setAttribute("base-url", "https://auth.mysph.ayaypaw.app")
      if (DESCOPE_BASE_URL) element.setAttribute("base-url", DESCOPE_BASE_URL);

      element.onScreenUpdate = (name, context, next, host) =>
        onScreenUpdate(name, context, next, host);
      element.addEventListener("success", onSuccess);
      element.addEventListener("error", onError);
      element.addEventListener("ready", () => setInitializing(false), {
        once: true,
      });

      mountRef.current.replaceChildren(element);
    }

    void initialize().catch((cause) => {
      if (!cancelled) {
        setFatalError(getErrorMessage(cause, "Could not load Descope"));
        setInitializing(false);
      }
    });

    return () => {
      cancelled = true;
      if (pollingKickoffRef.current !== null) {
        window.clearTimeout(pollingKickoffRef.current);
        pollingKickoffRef.current = null;
      }
      setScreen(null);
      element?.removeEventListener("success", onSuccess);
      element?.removeEventListener("error", onError);
      element?.remove();
    };
  }, [mountRef]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1_000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /** Sends `action` (and any input) to the Flow for the current screen. */
  async function performAction(
    action: string,
    input: Record<string, string> = {},
  ) {
    if (!screen || submitting) return;
    setLocalError(null);
    setSubmitting(true);

    try {
      await screen.next(action, input);
    } catch (cause) {
      setLocalError(getErrorMessage(cause));
      setSubmitting(false);
    }
  }

  function submitCredentials(
    action: typeof ACTION_EMAIL | typeof ACTION_PASSWORD,
  ) {
    const normalized = email.trim();
    if (!normalized || !normalized.includes("@")) {
      setLocalError("Enter a valid email address");
      return;
    }

    if (action === ACTION_PASSWORD && !password) {
      setLocalError("Enter your password");
      return;
    }

    setEmail(normalized);
    void performAction(
      action,
      action === ACTION_PASSWORD
        ? { email: normalized, password }
        : { email: normalized },
    );
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitCredentials(ACTION_PASSWORD);
  }

  function submitEmail() {
    submitCredentials(ACTION_EMAIL);
  }

  function submitGoogle() {
    void performAction(ACTION_GOOGLE, { provider: "google" });
  }

  function resend() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    void performAction(ACTION_RESEND, { email });
  }

  function back() {
    void performAction(ACTION_BACK);
  }

  function selectUiOption(option: UiOption) {
    setUiOption(option);
    const url = new URL(window.location.href);
    url.searchParams.set("ui", option);
    window.history.replaceState({}, "", url);
  }

  const sentTo =
    screen?.context.data?.sentTo?.maskedEmail || email || "your email address";

  return {
    screen,
    screenName: screen?.name,
    initializing,
    submitting,
    fatalError,
    error,
    email,
    setEmail,
    password,
    setPassword,
    cooldown,
    uiOption,
    selectUiOption,
    sentTo,
    submitPassword,
    submitEmail,
    submitGoogle,
    resend,
    back,
  };
}
