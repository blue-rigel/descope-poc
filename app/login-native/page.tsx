"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getDescope } from "@/lib/descope-client";
import { POST_LOGIN_PATH } from "@/lib/descope-config";

type Mode = "signin" | "signup";

/**
 * Flow 2 — Email/Password Login (Native).
 * Custom in-app form driven directly by the web-js SDK (no hosted redirect).
 * On success the SDK sets the `DS` session cookie and we route to the profile.
 */
export default function NativeLoginPage() {
  return (
    <Suspense>
      <NativeLoginForm />
    </Suspense>
  );
}

function NativeLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dest = searchParams.get("from") ?? POST_LOGIN_PATH;

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const sdk = getDescope();
      const res =
        mode === "signin"
          ? await sdk.password.signIn(email, password)
          : await sdk.password.signUp(email, password);

      if (!res.ok) {
        setError(res.error?.errorMessage ?? "Authentication failed");
        return;
      }
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
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
          <form onSubmit={submit} className="space-y-3">
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
