"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Globe, KeyRound, Lock, Mail, Monitor, Network, ShieldCheck, Smartphone, TabletSmartphone, Trash2, UserRound, Users } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const clearCache = () => {
    if (
      !window.confirm(
        "Clear all local storage, session storage, and cookies for this site?",
      )
    ) {
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    // Expire every cookie readable by JS (path=/). HttpOnly cookies can't be
    // cleared from the browser, but Descope's DS/DSR session cookies aren't
    // HttpOnly, so this signs the user out too.
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim();
      if (name) {
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
      }
    }
  };

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-2xl mt-16">
        <CardHeader className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Descope PoC</h1>
          <p className="text-muted-foreground mt-2">
            Available flows/features for testing and demonstration purposes
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-1">
            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/auth/login">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Custom Descope Flow</div>
                  <div className="text-sm text-muted-foreground">
                    BYOS password, email OTP, and Google authentication
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/login-otp">
                <KeyRound className="h-5 w-5 text-violet-600" />
                <div>
                  <div className="font-medium">Email OTP Signup / Login</div>
                  <div className="text-sm text-muted-foreground">
                    Passwordless sign-up-or-in with a 6-digit code
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/login-native">
                <Smartphone className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Email/Password Login (Native)</div>
                  <div className="text-sm text-muted-foreground">
                    Direct API flow, token-based session
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/native/login?pubId=demo&platform=ios&redirectUrl=descopepoc%3A%2F%2Fauth%2Fcallback">
                <TabletSmartphone className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-medium">Native Webview Host</div>
                  <div className="text-sm text-muted-foreground">
                    Web login form in a webview → deep-link code hand-off
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/auth/google">
                <Globe className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium">Continue with Google</div>
                  <div className="text-sm text-muted-foreground">
                    Social sign-in
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/me">
                <UserRound className="h-5 w-5 text-indigo-600" />
                <div>
                  <div className="font-medium">My Profile</div>
                  <div className="text-sm text-muted-foreground">
                    View the currently authenticated user
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/auth/settings">
                <ShieldCheck className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">Account Settings (MFA)</div>
                  <div className="text-sm text-muted-foreground">
                    Enroll TOTP and Passkey/WebAuthn, manage profile
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/sensitive">
                <Lock className="h-5 w-5 text-rose-600" />
                <div>
                  <div className="font-medium">Step-up Auth Demo</div>
                  <div className="text-sm text-muted-foreground">
                    AAL2-gated route with live assessment panel
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/sso/app">
                <Network className="h-5 w-5 text-cyan-600" />
                <div>
                  <div className="font-medium">SSO Demo</div>
                  <div className="text-sm text-muted-foreground">
                    Redirect to hosted login, return to profile on success
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/sessions">
                <Monitor className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-medium">Manage Sessions</div>
                  <div className="text-sm text-muted-foreground">
                    List active sessions across devices, revoke any of them
                  </div>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 justify-start gap-3 text-left bg-transparent"
            >
              <Link href="/admin/identities">
                <Users className="h-5 w-5 text-amber-600" />
                <div>
                  <div className="font-medium">Admin: Identities</div>
                  <div className="text-sm text-muted-foreground">
                    List, disable, and delete identities via Admin API
                  </div>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>

        <CardFooter className="justify-center">
          <Button
            onClick={clearCache}
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
            Clear Storage &amp; Cookies
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
