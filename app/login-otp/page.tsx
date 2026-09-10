"use client";

import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDescope } from "@/lib/descope-client";
import { POST_LOGIN_PATH } from "@/lib/descope-config";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type Action = "send" | "verify" | "resend" | null;

function findErrorDescription(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;

  if (
    typeof record.errorDescription === "string" &&
    record.errorDescription
  ) {
    return record.errorDescription;
  }

  for (const key of ["error", "data", "body", "cause"] as const) {
    if (key in record) {
      const description = findErrorDescription(record[key]);
      if (description) return description;
    }
  }
}

async function getErrorDescription(value: unknown, response?: Response) {
  const description = findErrorDescription(value);
  if (description) return description;

  try {
    const body: unknown = await response?.clone().json();
    const responseDescription = findErrorDescription(body);
    if (responseDescription) return responseDescription;
  } catch {
    // Keep the generic fallback for missing or non-JSON response bodies.
  }

  return value instanceof Error ? value.message : "Authentication failed";
}

export default function OtpLoginPage() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [digits, setDigits] = useState(() =>
    Array<string>(CODE_LENGTH).fill(""),
  );
  const [action, setAction] = useState<Action>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const awaitingCode = Boolean(submittedEmail);
  const code = digits.join("");

  useEffect(() => {
    if (cooldown === 0) return;

    const timer = window.setTimeout(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const focusCodeInput = (index: number) => {
    window.requestAnimationFrame(() => inputRefs.current[index]?.focus());
  };

  const requestCode = async (loginId: string, requestAction: Action) => {
    setAction(requestAction);
    setError(null);

    try {
      const result = await getDescope().otp.signUpOrIn.email(loginId);
      if (!result.ok) {
        setError(await getErrorDescription(result.error, result.response));
        return false;
      }

      setMaskedEmail(result.data?.maskedEmail ?? loginId);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch (requestError) {
      setError(await getErrorDescription(requestError));
      return false;
    } finally {
      setAction(null);
    }
  };

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const loginId = email.trim();
    if (!loginId) return;

    if (await requestCode(loginId, "send")) {
      setSubmittedEmail(loginId);
      setDigits(Array<string>(CODE_LENGTH).fill(""));
      focusCodeInput(0);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) return;

    setAction("verify");
    setError(null);

    try {
      const result = await getDescope().otp.verify.email(submittedEmail, code);
      if (!result.ok) {
        setError(await getErrorDescription(result.error, result.response));
        return;
      }

      const auth = result.data;
      if (!auth) {
        setError("Authentication succeeded without session information");
        return;
      }

      window.location.replace(POST_LOGIN_PATH);
    } catch (verifyError) {
      setError(await getErrorDescription(verifyError));
    } finally {
      setAction(null);
    }
  };

  const resendCode = async () => {
    if (cooldown > 0 || action) return;

    if (await requestCode(submittedEmail, "resend")) {
      setDigits(Array<string>(CODE_LENGTH).fill(""));
      focusCodeInput(0);
    }
  };

  const applyDigits = (value: string, startIndex: number) => {
    const nextValues = value.replace(/\D/g, "");
    if (!nextValues) return;

    const nextDigits = [...digits];
    for (
      let offset = 0;
      offset < nextValues.length && startIndex + offset < CODE_LENGTH;
      offset += 1
    ) {
      nextDigits[startIndex + offset] = nextValues[offset];
    }
    setDigits(nextDigits);

    const nextIndex = Math.min(
      startIndex + nextValues.length,
      CODE_LENGTH - 1,
    );
    focusCodeInput(nextIndex);
  };

  const handleDigitChange = (value: string, index: number) => {
    if (!value) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      return;
    }

    applyDigits(value, index);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const targetIndex = digits[index] ? index : Math.max(0, index - 1);
      const nextDigits = [...digits];
      nextDigits[targetIndex] = "";
      setDigits(nextDigits);
      focusCodeInput(targetIndex);
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusCodeInput(index - 1);
    }

    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusCodeInput(index + 1);
    }
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pastedDigits) return;

    event.preventDefault();
    applyDigits(pastedDigits, index);
  };

  const changeEmail = () => {
    setSubmittedEmail("");
    setMaskedEmail("");
    setDigits(Array<string>(CODE_LENGTH).fill(""));
    setCooldown(0);
    setError(null);
  };

  return (
    <section className="flex justify-center px-4">
      <Card className="mt-16 w-full max-w-md">
        <CardHeader className="text-center">
          <MailCheck className="mx-auto h-8 w-8 text-violet-600" />
          <CardTitle className="mt-2">
            {awaitingCode ? "Check your email" : "Continue with email"}
          </CardTitle>
          <CardDescription>
            {awaitingCode
              ? `Enter the 6-digit code sent to ${maskedEmail}.`
              : "Sign up or log in with a one-time verification code."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!awaitingCode ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="otp-email" className="text-sm font-medium">
                  Email address
                </label>
                <Input
                  id="otp-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                  aria-invalid={Boolean(error)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={Boolean(action)}>
                {action === "send" ? "Sending code..." : "Send verification code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-5">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Verification code</legend>
                <div className="flex justify-between gap-2">
                  {digits.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={index === 0 ? CODE_LENGTH : 1}
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      value={digit}
                      onChange={(event) =>
                        handleDigitChange(event.target.value, index)
                      }
                      onKeyDown={(event) => handleKeyDown(event, index)}
                      onPaste={(event) => handlePaste(event, index)}
                      onFocus={(event) => event.currentTarget.select()}
                      aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                      aria-invalid={Boolean(error)}
                      disabled={action === "verify"}
                      className="h-12 w-12 px-0 text-center font-mono text-xl font-semibold sm:h-14 sm:w-14"
                    />
                  ))}
                </div>
              </fieldset>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={code.length !== CODE_LENGTH || Boolean(action)}
              >
                {action === "verify" ? "Verifying..." : "Verify and continue"}
              </Button>

              <div className="space-y-2 text-center text-sm text-muted-foreground">
                <p>
                  Didn&apos;t receive a code?{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                    onClick={resendCode}
                    disabled={cooldown > 0 || Boolean(action)}
                  >
                    {action === "resend"
                      ? "Sending..."
                      : cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : "Resend code"}
                  </button>
                </p>
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4"
                  onClick={changeEmail}
                  disabled={Boolean(action)}
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
