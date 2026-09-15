import { ArrowRight, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { SCREEN_MAGIC_LINK_SENT, SCREEN_WELCOME } from "../_lib/constants";
import type { ScreenProps } from "../_lib/types";
import { EmailButton } from "./email-button";
import { Feedback } from "./feedback";
import { GoogleButton } from "./google-button";
import { StatusContent } from "./status-content";
import { UiPicker } from "./ui-picker";

export function MinimalScreen({
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
    <>
      <UiPicker value={uiOption} onChange={onUiOptionChange} />
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
            <form className="space-y-4" onSubmit={onPasswordSubmit}>
              <div className="space-y-2">
                <label htmlFor="minimal-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="minimal-email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="name@company.com" autoComplete="email" autoFocus disabled={submitting} aria-invalid={Boolean(error)} className="h-11 pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="minimal-password" className="text-sm font-medium">Password</label>
                <Input id="minimal-password" name="password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Password" autoComplete="current-password" required disabled={submitting} aria-invalid={Boolean(error)} className="h-11" />
              </div>
              <Button type="submit" className="group h-11 w-full justify-between px-4" disabled={submitting}>
                Continue with password
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <EmailButton onSend={onEmailAction} disabled={submitting} />
              <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:border-t"><span className="relative bg-card px-3">or</span></div>
              <GoogleButton onClick={onGoogleAction} disabled={submitting} />
            </form>
          ) : (
            <div className="space-y-4">
              <StatusContent submitting={submitting} cooldown={cooldown} onResend={onResend} onBack={onBack} />
            </div>
          )}
          <Feedback error={error} submitting={submitting} />
        </CardContent>
      </Card>
    </>
  );
}
