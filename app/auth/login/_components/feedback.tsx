import { LoaderCircle } from "lucide-react";

type FeedbackProps = {
  error: string | null;
  submitting: boolean;
};

export function Feedback({ error, submitting }: FeedbackProps) {
  return (
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
}
