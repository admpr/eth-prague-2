"use client";

import { motion } from "framer-motion";
import { Cpu, Wallet, Clock, AlarmClockOff, Wand2, KeyRound } from "lucide-react";

const FEATURES = [
  {
    code: "F.01",
    icon: Cpu,
    title: "Hardware-rooted authority",
    body: "Your hardware wallet signs every privileged action. Agent keys never touch root authority.",
  },
  {
    code: "F.02",
    icon: Wallet,
    title: "Budgets enforced on-chain",
    body: "Cap an agent's daily spend in USDC, ETH, or any ERC-20. Limits live in smart-account policy, not in prompts.",
  },
  {
    code: "F.03",
    icon: Clock,
    title: "Time-boxed access",
    body: "Issue keys that expire at a wall-clock time. Sessions self-deactivate without a transaction.",
  },
  {
    code: "F.04",
    icon: AlarmClockOff,
    title: "One-click revocation",
    body: "Compromised an agent? Revoke just that key. Your address, balances, and reputation stay intact.",
  },
  {
    code: "F.05",
    icon: Wand2,
    title: "Capability presets",
    body: "Stablecoin assistant, DeFi rebalancer, claim bot — drag-and-drop policies anyone can read.",
  },
  {
    code: "F.06",
    icon: KeyRound,
    title: "Same address, smarter",
    body: "EIP-7702 keeps your existing EOA. Allowlists, NFT history, app permissions — all preserved.",
  },
];

export function FeatureGrid() {
  return (
    <section id="how" className="container py-24 md:py-32">
      <div className="grid gap-10 md:grid-cols-[auto_1fr] md:items-end md:gap-16">
        <div className="space-y-3">
          <span className="num-pin">02 / Architecture</span>
          <h2 className="max-w-2xl text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.02] tracking-tightest">
            A permission layer,
            <br />
            <span className="editorial text-accent">not</span> a new wallet.
          </h2>
        </div>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground md:justify-self-end md:text-right">
          Your agents act from your existing address with policies they cannot argue their way out of.
        </p>
      </div>

      <div className="hairline mt-12" />

      <div className="mt-0 grid border-t border-border/0 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body, code }, i) => (
          <motion.div
            key={code}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.05 }}
            className="group relative border-b border-border/50 p-8 transition-colors hover:bg-secondary/20 lg:[&:nth-child(3n)]:border-r-0 [&:not(:last-child)]:border-r border-r-border/50 lg:border-r-border/50"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center border border-border bg-secondary/40 text-foreground transition-colors group-hover:border-primary/60 group-hover:text-primary">
                <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.5} />
              </span>
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground/70">
                {code}
              </span>
            </div>
            <h3 className="mt-8 text-[1.0625rem] font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-muted-foreground">{body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
