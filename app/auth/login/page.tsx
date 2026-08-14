"use client";

import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  POST_LOGIN_PATH,
  absoluteUrl,
  hostedLoginUrl,
} from "@/lib/descope-config";

/**
 * Flow 1 — Email/Password Login (Browser).
 * A plain link out to Descope's hosted flow page. Descope hosts the entire UI;
 * on success it redirects back to POST_LOGIN_PATH with the session cookie set.
 */
export default function BrowserLoginPage() {
  const go = () => {
    window.location.href = hostedLoginUrl(absoluteUrl(POST_LOGIN_PATH));
  };

  return (
    <section className="flex justify-center">
      <Card className="w-full max-w-md mt-16">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-8 w-8 text-blue-600" />
          <CardTitle className="mt-2">Email / Password (Browser)</CardTitle>
          <CardDescription>
            Continue to Descope&apos;s hosted login page. After signing in you
            are returned here with a cookie-based session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={go}>
            Continue to hosted login
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
