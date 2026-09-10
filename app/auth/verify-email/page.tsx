"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDescope } from "@/lib/descope-client";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const token = new URLSearchParams(window.location.search).get("t");
      if (!token) {
        setError("The verification link is missing its token.");
        return;
      }

      try {
        const res = await getDescope().magicLink.verify(token);
        if (!active) return;
        if (!res.ok) {
          setError(res.error?.errorMessage ?? "Could not verify email address");
          return;
        }

        router.replace("/me");
        router.refresh();
      } catch (verifyError) {
        if (active) {
          setError(
            verifyError instanceof Error
              ? verifyError.message
              : "Could not verify email address",
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <section className="flex justify-center px-4">
      <p
        role={error ? "alert" : "status"}
        className={`mt-24 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}
      >
        {error ?? "Verifying your email address…"}
      </p>
    </section>
  );
}
