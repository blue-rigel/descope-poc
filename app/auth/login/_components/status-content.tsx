import { ArrowLeft, LoaderCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

type StatusContentProps = {
  submitting: boolean;
  cooldown: number;
  onResend: () => void;
  onBack: () => void;
};

/** Waiting-for-confirmation UI shown while polling for a clicked magic link. */
export function StatusContent({
  submitting,
  cooldown,
  onResend,
  onBack,
}: StatusContentProps) {
  return (
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
        onClick={onResend}
        disabled={submitting || cooldown > 0}
      >
        <RotateCcw className="h-4 w-4" />
        {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
      </Button>
      <button
        type="button"
        className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        onClick={onBack}
        disabled={submitting}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Use another sign-in method
      </button>
    </>
  );
}
