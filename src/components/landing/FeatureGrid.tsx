"use client";

import { motion } from "framer-motion";
import { Cpu, Wallet, Clock, AlarmClockOff, Wand2, KeyRound } from "lucide-react";

const FEATURES = [
  {
    icon: Cpu,
    title: "Hardware-rooted authority",
    body: "Your hardware wallet signs every privileged action. Agent keys never touch root authority.",
  },
  {
    icon: Wallet,
    title: "Budgets enforced on-chain",
    body: "Cap an agent's daily spend in USDC, ETH, or any ERC-20. Limits live in smart-account policy, not in prompts.",
  },
  {
    icon: Clock,
    title: "Time-boxed access",
    body: "Issue keys that expire at a wall-clock time. Sessions self-deactivate without a transaction.",
  },
  {
    icon: AlarmClockOff,
    title: "One-click revocation",
    body: "Compromised an agent? Revoke just that key. Your address, balances, and reputation stay intact.",
  },
  {
    icon: Wand2,
    title: "Capability presets",
    body: "Stablecoin assistant, DeFi rebalancer, claim bot — drag-and-drop policies anyone can read.",
  },
  {
    icon: KeyRound,
    title: "Same address, smarter",
    body: "EIP-7702 keeps your existing EOA. Allowlists, NFT history, app permissions — all preserved.",
  },
];

export function FeatureGrid() {
  return (
    <section id="how" className="container py-20 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          A permission layer, not a new wallet.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Your agents act from your existing address with policies they can't argue their way out of.
        </p>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="rounded-2xl surface p-6"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
