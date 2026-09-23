"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Temporary browser landing page for native auth-code testing.
 * The hand-off deep-links here with `?code=…&code_verifier=…&state=…`
 * so you can confirm MAGW_Mobile_App returned an authorization code.
 */
export default function NativeAuthCodePage() {
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const search = new URL(window.location.href).searchParams;
    const next: Record<string, string> = {};
    for (const key of ["code", "code_verifier", "state", "error", "error_description"]) {
      const value = search.get(key);
      if (value) next[key] = value;
    }
    setParams(next);
  }, []);

  const hasCode = Boolean(params.code);
  const hasError = Boolean(params.error);

  return (
    <section className="flex justify-center px-4">
      <Card className="w-full max-w-lg mt-12">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-8 w-8 text-emerald-600" />
          <CardTitle className="mt-2">
            {hasError
              ? "Authorization failed"
              : hasCode
                ? "Authorization code received"
                : "Waiting for authorization code"}
          </CardTitle>
          <CardDescription>
            {hasError
              ? "MAGW_Mobile_App returned an error instead of a code."
              : hasCode
                ? "Federated App MAGW_Mobile_App completed the authorize hop."
                : "Open /native/login with redirectUrl pointing here, then sign in."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(params).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No query parameters on this URL yet.
            </p>
          ) : (
            Object.entries(params).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {key}
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs break-all whitespace-pre-wrap">
                  {value}
                </pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
