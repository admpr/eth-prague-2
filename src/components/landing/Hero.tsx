"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HardwareWalletArt } from "@/components/shared/HardwareWalletArt";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container relative grid items-center gap-12 py-20 md:py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="accent">
              <Sparkles className="h-3.5 w-3.5" /> Hardware-rooted EIP-7702 on Base Sepolia
            </Badge>
          </motion.div>

          <motion.h1
            className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            Hire AI employees.
            <br />
            <span className="text-gradient">Keep the keys.</span>
          </motion.h1>

          <motion.p
            className="max-w-xl text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Turn your hardware-wallet EOA into a smart account in one signature, then issue
            scoped session keys to your AI agents — with budgets, allowlists, and revocation
            enforced on-chain.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-4"
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
            <Button asChild variant="ghost" size="lg">
              <Link href="#how">Learn how it works</Link>
            </Button>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {[
              "Hardware wallet stays the root",
              "On-chain budget enforcement",
              "Revoke a key in one click",
            ].map((line) => (
              <div
                key={line}
                className="flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {line}
              </div>
            ))}
          </motion.div>
        </div>

        <div className="relative">
          <HardwareWalletArt />
        </div>
      </div>
    </section>
  );
}
