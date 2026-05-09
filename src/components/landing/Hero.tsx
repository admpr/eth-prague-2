"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixelAgentParade } from "@/components/shared/PixelAgentParade";

const TENETS = [
  { code: "01", line: "Hardware wallet stays the root of trust" },
  { code: "02", line: "On-chain budgets, never prompt-based limits" },
  { code: "03", line: "Revoke any agent in a single transaction" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-px bg-border/40 md:block" />
      <div className="container relative grid items-stretch gap-16 py-20 md:py-28 lg:grid-cols-[1fr_1.05fr] lg:gap-16 xl:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col justify-center space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <span className="num-pin">01 / Permission Layer</span>
            <span className="hidden h-px flex-1 bg-border/60 sm:block" />
            <span className="ticker hidden sm:inline">EIP-7702 · Base Sepolia</span>
          </motion.div>

          <motion.h1
            className="text-[clamp(2.75rem,6.4vw,5.5rem)] font-semibold leading-[0.96] tracking-tightest"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            Hire AI employees.
            <br />
            <span className="editorial text-[1.08em] text-accent">Keep</span>
            <span className="ml-3">the keys.</span>
          </motion.h1>

          <motion.p
            className="max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Turn your hardware-wallet EOA into a smart account in one signature, then issue
            scoped session keys to your agents — with budgets, allowlists, and revocation
            enforced on-chain.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <Button asChild size="lg">
              <Link href="/connect">
                Connect Hardware Wallet
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#how">
                <span className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground">[ 02 ]</span>
                How it works
              </Link>
            </Button>
          </motion.div>

          <motion.dl
            className="grid grid-cols-1 divide-y divide-border/50 border-y border-border/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22 }}
          >
            {TENETS.map(({ code, line }) => (
              <div key={code} className="flex items-start gap-3 px-0 py-4 sm:px-5 sm:first:pl-0">
                <span className="mt-0.5 font-mono text-[0.7rem] tracking-[0.18em] text-primary">
                  {code}
                </span>
                <span className="text-[0.85rem] leading-snug text-foreground/85">{line}</span>
              </div>
            ))}
          </motion.dl>

          <p className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Hardware-rooted authority. The relayer never sees your seed.
          </p>
        </div>

        <div className="relative flex w-full items-stretch">
          <PixelAgentParade />
        </div>
      </div>
    </section>
  );
}
