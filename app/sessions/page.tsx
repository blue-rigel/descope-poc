"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2, LogOut, MapPin, Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  clearSessionCookie,
  getDescope,
} from "@/lib/descope-client";
import { LOGIN_PATH } from "@/lib/descope-config";

type HistoryRecord = {
  userId: string;
  loginTime: number;
  city: string;
  country: string;
  ip: string;
};

export default function SessionsPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDescope().history();
      if (!res.ok) {
        setError(res.error?.errorMessage ?? "Could not load session history");
        return;
      }
      // Newest first.
      const records = (res.data ?? []) as HistoryRecord[];
      records.sort((a, b) => b.loginTime - a.loginTime);
      setHistory(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const logoutEverywhere = async () => {
    setRevoking(true);
    try {
      // Descope has no per-session revoke — logoutAll ends every session
      // (including this one). Clear the mirrored cookie so the proxy sees it.
      await getDescope().logoutAll();
    } finally {
      clearSessionCookie();
      router.push(LOGIN_PATH);
      router.refresh();
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Recent sign-in activity for your account.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading activity…</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {history && history.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No sign-in activity found.
        </p>
      )}

      {history && history.length > 0 && (
        <div className="space-y-3">
          {history.map((h, i) => (
            <Card key={`${h.loginTime}-${h.ip}-${i}`}>
              <CardContent className="flex items-center gap-4 py-4">
                <Monitor className="h-8 w-8 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {new Date(h.loginTime * 1000).toLocaleString()}
                    {i === 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        Most recent
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {[h.city, h.country].filter(Boolean).join(", ") ||
                        "Unknown location"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Globe2 className="h-3.5 w-3.5" />
                      {h.ip || "Unknown IP"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Log out everywhere</CardTitle>
          <CardDescription>
            Descope does not support revoking individual sessions, so this ends{" "}
            <strong>all</strong> sessions on every device — including this one —
            and signs you out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={logoutEverywhere}
            disabled={revoking}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {revoking ? "Signing out…" : "Log out of all devices"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
