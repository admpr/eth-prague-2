import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentForce — Hire AI employees, keep your keys",
  description:
    "A hardware-wallet-rooted permission layer for AI agents. Delegate scoped budgets, revoke instantly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        <div className="grid-pattern fixed inset-0 -z-10 opacity-50" />
        {children}
      </body>
    </html>
  );
}
