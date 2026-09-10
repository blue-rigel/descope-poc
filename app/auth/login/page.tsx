"use client";

import {
  type FormEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Mail,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDescope, initializeSessionRefresh } from "@/lib/descope-client";
import {
  DESCOPE_BASE_URL,
  DESCOPE_FLOW_ID,
  DESCOPE_PROJECT_ID,
  POST_LOGIN_PATH,
  safeReturnPath,
} from "@/lib/descope-config";

// These names and interaction IDs must match the active Descope Flow exactly.
const SCREEN_WELCOME = "Welcome Screen";
const SCREEN_MAGIC_LINK_SENT = "Magic Link Sent";

const INTERACTION_EMAIL = "ygSMAX5_SA";
const INTERACTION_GOOGLE = "gSxXWXi6pr";
const INTERACTION_RESEND = "resend";
const INTERACTION_BACK = "EbW8KMdjAx";
const INTERACTION_POLLING = "polling";

const RESEND_COOLDOWN_SECONDS = 60;

type UiOption = "minimal" | "editorial" | "workspace";

const UI_OPTIONS: Array<{ id: UiOption; label: string }> = [
  { id: "minimal", label: "Minimal" },
  { id: "editorial", label: "Editorial" },
  { id: "workspace", label: "Workspace" },
];

type DescopeElement =
  InstanceType<typeof import("@descope/web-component").default>;
type ScreenUpdate = NonNullable<DescopeElement["onScreenUpdate"]>;
type ScreenContext = Parameters<ScreenUpdate>[1];
type Next = Parameters<ScreenUpdate>[2];

type CustomScreen = {
  name: string;
  context: ScreenContext;
  next: Next;
  host: DescopeElement;
};

type DescopeError = {
  errorCode?: string;
  errorDescription?: string;
  errorMessage?: string;
};

function isCustomScreen(name: string) {
  return [SCREEN_WELCOME, SCREEN_MAGIC_LINK_SENT].includes(name);
}

function getErrorMessage(value: unknown, fallback = "Authentication failed") {
  if (!value || typeof value !== "object") return fallback;
  const error = value as DescopeError;
  return error.errorMessage || error.errorDescription || fallback;
}

export default function ByosLoginPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef(POST_LOGIN_PATH);
  const pollingStepRef = useRef("");
  const pollingKickoffRef = useRef<number | null>(null);

  const [screen, setScreen] = useState<CustomScreen | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [uiOption, setUiOption] = useState<UiOption>("minimal");

  const flowError = screen?.context.error?.text || null;
  const error = localError || flowError;

  const onScreenUpdate = useEffectEvent(
    (name: string, context: ScreenContext, next: Next, host: DescopeElement) => {
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

          // A built-in polling loader normally sends this first interaction.
          // BYOS hides that loader, so start it once; the web component then
          // owns the recurring two-second polling loop.
          if (context.action !== "poll") {
            pollingKickoffRef.current = window.setTimeout(() => {
              pollingKickoffRef.current = null;
              void next(INTERACTION_POLLING, {}).catch((cause) => {
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

  const onSuccess = useEffectEvent(async () => {
    try {
      await getDescope().refresh();
    } finally {
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
      const requestedUi = new URL(window.location.href).searchParams.get("ui");
      if (UI_OPTIONS.some(({ id }) => id === requestedUi)) {
        setUiOption(requestedUi as UiOption);
      }

      destinationRef.current = safeReturnPath(
        new URL(window.location.href).searchParams.get("from"),
      );

      if (await initializeSessionRefresh()) {
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
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1_000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(
    interactionId: string,
    input: Record<string, string> = {},
  ) {
    if (!screen || submitting) return;
    setLocalError(null);
    setSubmitting(true);

    try {
      await screen.next(interactionId, input);
    } catch (cause) {
      setLocalError(getErrorMessage(cause));
      setSubmitting(false);
    }
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim();
    if (!normalized || !normalized.includes("@")) {
      setLocalError("Enter a valid email address");
      return;
    }

    setEmail(normalized);
    void submit(INTERACTION_EMAIL, { email: normalized });
  }

  function selectUiOption(option: UiOption) {
    setUiOption(option);
    const url = new URL(window.location.href);
    url.searchParams.set("ui", option);
    window.history.replaceState({}, "", url);
  }

  const sentTo =
    screen?.context.data?.sentTo?.maskedEmail || email || "your email address";
  const screenName = screen?.name;

  const uiPicker = (
    <div
      className="mx-auto mb-4 flex w-fit rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur"
      aria-label="Login UI options"
    >
      {UI_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${uiOption === option.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
            }`}
          onClick={() => selectUiOption(option.id)}
          aria-pressed={uiOption === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const googleButton = (
    <button
      type="button"
      className="relative flex h-10 w-full items-center justify-center rounded-full border border-[#747775] bg-white px-3 text-sm font-medium leading-5 text-[#1f1f1f] transition-colors hover:bg-[#f8faff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] disabled:cursor-not-allowed disabled:opacity-60"
      onClick={() => void submit(INTERACTION_GOOGLE, { provider: "google" })}
      disabled={submitting}
    >
      <Image
        src="/google-g.svg"
        alt=""
        aria-hidden="true"
        width={18}
        height={18}
        className="absolute left-3 h-[18px] w-[18px]"
      />
      Sign in with Google
    </button>
  );

  const statusContent = (
    <>
      <div className="rounded-lg border bg-muted/30 px-4 py-5 text-center">
        <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-border">
          <LoaderCircle className="h-5 w-5 animate-spin" />
        </span>
        <p className="text-sm font-medium">Waiting for confirmation</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Open the link in the email. This page will continue automatically
          after you approve the sign-in.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Checking every 2 seconds
        </p>
      </div>
      <Button
        type="button"
        className="h-10 w-full"
        variant="outline"
        onClick={() => {
          setCooldown(RESEND_COOLDOWN_SECONDS);
          void submit(INTERACTION_RESEND, { email });
        }}
        disabled={submitting || cooldown > 0}
      >
        <RotateCcw className="h-4 w-4" />
        {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
      </Button>
      <button
        type="button"
        className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        onClick={() => void submit(INTERACTION_BACK)}
        disabled={submitting}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Use another sign-in method
      </button>
    </>
  );

  const feedback = (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {submitting && (
        <p
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Continuing...
        </p>
      )}
    </>
  );

  const minimalScreen = (
    <>
      {uiPicker}
      <Card className="mx-auto w-full max-w-sm gap-0 border-border/80 py-0 shadow-sm">
        <CardHeader className="px-6 pb-2 pt-7 text-center">
          <div className="mx-auto mb-5 grid h-10 w-10 place-items-center rounded-lg bg-foreground text-xs font-bold tracking-tight text-background">
            ID
          </div>
          <CardTitle className="text-2xl tracking-tight">
            {screenName === SCREEN_MAGIC_LINK_SENT ? "Check your email" : "Sign in"}
          </CardTitle>
          <CardDescription className="mt-2 leading-5">
            {screenName === SCREEN_MAGIC_LINK_SENT
              ? `We sent a sign-in link to ${sentTo}.`
              : "Continue to your IDPF account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-7 pt-5" aria-busy={submitting}>
          {screenName === SCREEN_WELCOME ? (
            <form className="space-y-4" onSubmit={submitEmail}>
              <div className="space-y-2">
                <label htmlFor="minimal-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="minimal-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="email" autoFocus disabled={submitting} aria-invalid={Boolean(error)} className="h-11 pl-10" />
                </div>
              </div>
              <Button type="submit" className="group h-11 w-full justify-between px-4" disabled={submitting}>
                Continue with email
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:border-t"><span className="relative bg-card px-3">or</span></div>
              {googleButton}
            </form>
          ) : <div className="space-y-4">{statusContent}</div>}
          {feedback}
        </CardContent>
      </Card>
    </>
  );

  const editorialScreen = (
    <div className="mx-auto w-full max-w-sm">
      {uiPicker}
      <div className="border-y border-stone-300 bg-[#fffdf8] px-2 py-8 text-stone-900 dark:border-stone-700">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a04434]">IDPF Journal</p>
        <h1 className="mt-5 font-serif text-4xl leading-none tracking-tight">{screenName === SCREEN_MAGIC_LINK_SENT ? "Check your inbox." : "Welcome back."}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{screenName === SCREEN_MAGIC_LINK_SENT ? `We sent a sign-in link to ${sentTo}.` : "Sign in to continue reading."}</p>
        <div className="mt-7 space-y-4">
          {screenName === SCREEN_WELCOME ? (
            <form className="space-y-4" onSubmit={submitEmail}>
              <label htmlFor="editorial-email" className="sr-only">Email</label>
              <Input id="editorial-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" autoComplete="email" disabled={submitting} aria-invalid={Boolean(error)} className="h-11 rounded-none border-x-0 border-t-0 border-stone-400 bg-transparent px-0 text-stone-900 shadow-none focus-visible:ring-0" />
              <Button type="submit" className="h-10 w-full rounded-none bg-[#a04434] text-white hover:bg-[#843426]" disabled={submitting}>Continue with email</Button>
              <div className="text-center font-serif text-sm italic text-stone-500">or</div>
              {googleButton}
            </form>
          ) : <div className="space-y-4">{statusContent}</div>}
          {feedback}
        </div>
      </div>
    </div>
  );

  const workspaceScreen = (
    <div className="mx-auto w-full max-w-sm">
      {uiPicker}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 text-sm font-semibold dark:border-slate-800">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-[10px] font-bold text-white">ID</span>
          IDPF Workspace
        </div>
        <main className="p-6">
          <h1 className="text-xl font-semibold tracking-tight">{screenName === SCREEN_MAGIC_LINK_SENT ? "Check your email" : "Sign in"}</h1>
          <p className="mt-2 text-sm text-slate-500">{screenName === SCREEN_MAGIC_LINK_SENT ? `We sent a link to ${sentTo}.` : "Use your work email or Google account."}</p>
          <div className="mt-6 space-y-4">
            {screenName === SCREEN_WELCOME ? (
              <form className="space-y-4" onSubmit={submitEmail}>
                <div className="space-y-2"><label htmlFor="workspace-email" className="text-sm font-medium">Work email</label><Input id="workspace-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" disabled={submitting} aria-invalid={Boolean(error)} className="h-11" /></div>
                <Button type="submit" className="h-10 w-full bg-blue-600 text-white hover:bg-blue-700" disabled={submitting}>Continue</Button>
                <div className="relative py-1 text-center text-xs text-slate-400 before:absolute before:inset-x-0 before:top-1/2 before:border-t"><span className="relative bg-white px-3 dark:bg-slate-950">or</span></div>
                {googleButton}
              </form>
            ) : <div className="space-y-4">{statusContent}</div>}
            {feedback}
          </div>
        </main>
      </div>
    </div>
  );

  const customScreen = screen && (
    <>
      {uiOption === "minimal" && minimalScreen}
      {uiOption === "editorial" && editorialScreen}
      {uiOption === "workspace" && workspaceScreen}
    </>
  );

  return (
    <section className="flex justify-center px-4 pb-12">
      <div ref={mountRef} className={screen ? "mt-8 w-full max-w-5xl" : "mt-12"} />

      {initializing && !fatalError && (
        <Card className="mt-12 w-full max-w-md">
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Starting secure sign-in...
          </CardContent>
        </Card>
      )}

      {fatalError && (
        <Card className="mt-12 w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication stopped</CardTitle>
            <CardDescription role="alert">{fatalError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" className="w-full" onClick={() => window.location.reload()}>
              Restart authentication
            </Button>
          </CardContent>
        </Card>
      )}

      {customScreen && createPortal(customScreen, screen.host)}
    </section>
  );
}
