import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallexa — Hire AI employees, keep your keys",
  description:
    "A hardware-wallet-rooted permission layer for AI agents. Delegate scoped budgets, revoke instantly.",
  icons: {
    icon: "/wallexa-logo.png",
    apple: "/wallexa-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-screen relative" suppressHydrationWarning>
        <div className="grid-pattern pointer-events-none fixed inset-0 -z-10 opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(hsl(0 0% 100% / 0.025) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(50% 35% at 88% 0%, hsl(333 80% 51% / 0.08), transparent 60%)",
          }}
        />
        {children}
      </body>
    </html>
  );
}
