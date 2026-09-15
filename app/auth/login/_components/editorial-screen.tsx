import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { SCREEN_MAGIC_LINK_SENT, SCREEN_WELCOME } from "../_lib/constants";
import type { ScreenProps } from "../_lib/types";
import { EmailButton } from "./email-button";
import { Feedback } from "./feedback";
import { GoogleButton } from "./google-button";
import { StatusContent } from "./status-content";
import { UiPicker } from "./ui-picker";

export function EditorialScreen({
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
  onEmailAction,
  onGoogleAction,
  onResend,
  onBack,
}: ScreenProps) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <UiPicker value={uiOption} onChange={onUiOptionChange} />
      <div className="border-y border-stone-300 bg-[#fffdf8] px-2 py-8 text-stone-900 dark:border-stone-700">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a04434]">IDPF Journal</p>
        <h1 className="mt-5 font-serif text-4xl leading-none tracking-tight">{screenName === SCREEN_MAGIC_LINK_SENT ? "Check your inbox." : "Welcome back."}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{screenName === SCREEN_MAGIC_LINK_SENT ? `We sent a sign-in link to ${sentTo}.` : "Sign in to continue reading."}</p>
        <div className="mt-7 space-y-4">
          {screenName === SCREEN_WELCOME ? (
            <form className="space-y-4" onSubmit={onPasswordSubmit}>
              <label htmlFor="editorial-email" className="sr-only">Email</label>
              <Input id="editorial-email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="Email address" autoComplete="email" disabled={submitting} aria-invalid={Boolean(error)} className="h-11 rounded-none border-x-0 border-t-0 border-stone-400 bg-transparent px-0 text-stone-900 shadow-none focus-visible:ring-0" />
              <label htmlFor="editorial-password" className="sr-only">Password</label>
              <Input id="editorial-password" name="password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Password" autoComplete="current-password" required disabled={submitting} aria-invalid={Boolean(error)} className="h-11 rounded-none border-x-0 border-t-0 border-stone-400 bg-transparent px-0 text-stone-900 shadow-none focus-visible:ring-0" />
              <Button type="submit" className="h-10 w-full rounded-none bg-[#a04434] text-white hover:bg-[#843426]" disabled={submitting}>Continue with password</Button>
              <EmailButton onSend={onEmailAction} disabled={submitting} />
              <div className="text-center font-serif text-sm italic text-stone-500">or</div>
              <GoogleButton onClick={onGoogleAction} disabled={submitting} />
            </form>
          ) : (
            <div className="space-y-4">
              <StatusContent submitting={submitting} cooldown={cooldown} onResend={onResend} onBack={onBack} />
            </div>
          )}
          <Feedback error={error} submitting={submitting} />
        </div>
      </div>
    </div>
  );
}
