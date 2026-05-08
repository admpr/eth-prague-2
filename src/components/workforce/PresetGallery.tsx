"use client";

import { motion } from "framer-motion";
import { Coins, Repeat, Gift, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PRESETS = [
  {
    icon: Coins,
    title: "Stablecoin Assistant",
    role: "Pays invoices and subscriptions",
    budget: "500 USDC / month",
    expires: "30 days",
    accent: "from-emerald-500/20 to-emerald-500/0",
    iconColor: "text-emerald-400",
  },
  {
    icon: Repeat,
    title: "DeFi Rebalancer",
    role: "Keeps your portfolio in target weights",
    budget: "0.5 ETH cap · swap-only",
    expires: "7 days",
    accent: "from-primary/20 to-primary/0",
    iconColor: "text-primary",
  },
  {
    icon: Gift,
    title: "Rewards Claimer",
    role: "Harvests rewards as they accrue",
    budget: "Zero spend · claim selectors only",
    expires: "30 days",
    accent: "from-accent/20 to-accent/0",
    iconColor: "text-accent",
  },
];

export function PresetGallery() {
  return (
    <section className="container pb-20">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">Capability presets</h3>
          <p className="text-sm text-muted-foreground">
            Curated policies for common agent jobs. Customize before hiring.
          </p>
        </div>
        <Badge variant="muted">Mocked for demo</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {PRESETS.map(({ icon: Icon, title, role, budget, expires, accent, iconColor }, i) => (
          <motion.article
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="group relative overflow-hidden rounded-2xl surface p-6 transition-transform hover:-translate-y-1"
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-50`}
            />
            <div className="relative space-y-5">
              <div className="flex items-start justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/80 ${iconColor}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <Badge variant="default">Policy preset</Badge>
              </div>
              <div>
                <h4 className="text-lg font-semibold">{title}</h4>
                <p className="text-sm text-muted-foreground">{role}</p>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Budget" value={budget} />
                <Row
                  label="Expires"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {expires}
                    </span>
                  }
                />
              </dl>
              <Button variant="outline" className="w-full" disabled>
                Hire with this preset
              </Button>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
