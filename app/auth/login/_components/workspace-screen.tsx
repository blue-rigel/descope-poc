import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { SCREEN_MAGIC_LINK_SENT, SCREEN_WELCOME } from "../_lib/constants";
import type { ScreenProps } from "../_lib/types";
import { EmailButton } from "./email-button";
import { Feedback } from "./feedback";
import { GoogleButton } from "./google-button";
import { StatusContent } from "./status-content";
import { UiPicker } from "./ui-picker";

export function WorkspaceScreen({
  screenName,
  sentTo,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  submitting,
  error,
  cooldown,
  uiOption,
  onUiOptionChange,
  onPasswordSubmit,
  onSignUpSubmit,
  onEmailAction,
  onGoogleAction,
  onResend,
  onBack,
}: ScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="mx-auto w-full max-w-sm">
      <UiPicker value={uiOption} onChange={onUiOptionChange} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 text-sm font-semibold dark:border-slate-800">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-[10px] font-bold text-white">ID</span>
          IDPF Workspace
        </div>
        <main className="p-6">
          <h1 className="text-xl font-semibold tracking-tight">{screenName === SCREEN_MAGIC_LINK_SENT ? "Check your email" : mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="mt-2 text-sm text-slate-500">{screenName === SCREEN_MAGIC_LINK_SENT ? `We sent a link to ${sentTo}.` : mode === "signin" ? "Use your work email or Google account." : "Create a new account with your work email."}</p>
          <div className="mt-6 space-y-4">
            {screenName === SCREEN_WELCOME ? (
              <form className="space-y-4" onSubmit={mode === "signin" ? onPasswordSubmit : onSignUpSubmit}>
                <div className="space-y-2"><label htmlFor="workspace-email" className="text-sm font-medium">{mode === "signin" ? "Work email" : "Email"}</label><Input id="workspace-email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@company.com" autoComplete="email" disabled={submitting} aria-invalid={Boolean(error)} className="h-11" /></div>
                <div className="space-y-2"><label htmlFor="workspace-password" className="text-sm font-medium">Password</label><Input id="workspace-password" name="password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required disabled={submitting} aria-invalid={Boolean(error)} className="h-11" /></div>
                <Button type="submit" className="h-10 w-full bg-blue-600 text-white hover:bg-blue-700" disabled={submitting}>{mode === "signin" ? "Continue with password" : "Create account"}</Button>
                {mode === "signin" && (
                  <>
                    <EmailButton onSend={onEmailAction} disabled={submitting} />
                    <div className="relative py-1 text-center text-xs text-slate-400 before:absolute before:inset-x-0 before:top-1/2 before:border-t"><span className="relative bg-white px-3 dark:bg-slate-950">or</span></div>
                    <GoogleButton onClick={onGoogleAction} disabled={submitting} />
                  </>
                )}
                <p className="text-center text-sm text-slate-500">
                  {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="text-blue-600 underline underline-offset-4"
                    onClick={() => {
                      setMode(mode === "signin" ? "signup" : "signin");
                    }}
                    disabled={submitting}
                  >
                    {mode === "signin" ? "Create one" : "Sign in"}
                  </button>
                </p>
              </form>
            ) : (
              <div className="space-y-4">
                <StatusContent submitting={submitting} cooldown={cooldown} onResend={onResend} onBack={onBack} />
              </div>
            )}
            <Feedback error={error} submitting={submitting} />
          </div>
        </main>
      </div>
    </div>
  );
}
