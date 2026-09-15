"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";

import { FatalErrorCard } from "./_components/fatal-error-card";
import { InitializingCard } from "./_components/initializing-card";
import { LoginScreen } from "./_components/login-screen";
import { useLoginFlow } from "./_hooks/use-login-flow";

export default function ByosLoginPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const flow = useLoginFlow(mountRef);

  const customScreen = flow.screen && (
    <LoginScreen
      screenName={flow.screenName}
      sentTo={flow.sentTo}
      email={flow.email}
      onEmailChange={flow.setEmail}
      password={flow.password}
      onPasswordChange={flow.setPassword}
      submitting={flow.submitting}
      error={flow.error}
      cooldown={flow.cooldown}
      uiOption={flow.uiOption}
      onUiOptionChange={flow.selectUiOption}
      onPasswordSubmit={flow.submitPassword}
      onEmailAction={flow.submitEmail}
      onGoogleAction={flow.submitGoogle}
      onResend={flow.resend}
      onBack={flow.back}
    />
  );

  return (
    <section className="flex justify-center px-4 pb-12">
      <div
        ref={mountRef}
        className={flow.screen ? "mt-8 w-full max-w-5xl" : "mt-12"}
      />

      {flow.initializing && !flow.fatalError && <InitializingCard />}

      {flow.fatalError && <FatalErrorCard message={flow.fatalError} />}

      {customScreen && flow.screen && createPortal(customScreen, flow.screen.host)}
    </section>
  );
}
