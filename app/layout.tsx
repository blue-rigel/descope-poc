import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IDPF Test App",
  description: "IDPF test app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="font-medium">
            IDPF Test App / Home
          </Link>
          <Link
            href="/me"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            My Profile
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
