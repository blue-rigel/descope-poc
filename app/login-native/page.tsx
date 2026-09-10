"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDescope, getDescopeOidc } from "@/lib/descope-client";

type Mode = "signin" | "signup";

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

/**
 * Flow 2 — Email/Password Login (Native).
 * Custom in-app form driven directly by the web-js SDK (no hosted redirect).
 * On success the SDK sets the `DS` session cookie and completes any pending
 * OIDC login without navigating away from this route.
 */
export default function NativeLoginPage() {
  return <NativeLoginForm />;
}

function NativeLoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const sdk = getDescopeOidc();
      const res =
        mode === "signin"
          ? await sdk.password.signIn(email, password)
          : await sdk.password.signUp(email, password);

      if (!res.ok) {
        setError(await getErrorDescription(res.error, res.response));
        return;
      }

      const auth = res.data;
      if (!auth) {
        setError("Authentication succeeded without session information");
        return;
      }



      const response = await getDescopeOidc().oidc.finishLoginIfNeed();
      console.log(response)

    } catch (err) {
      console.log(error)
      setError(await getErrorDescription(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <Smartphone className="mx-auto h-8 w-8 text-green-600" />
          <CardTitle className="mt-2">
            {mode === "signin" ? "Sign in" : "Create account"}
          </CardTitle>
          <CardDescription>
            Native email/password flow — API-driven, token-based session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={submit} className="space-y-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Sign up"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-foreground underline underline-offset-4"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
