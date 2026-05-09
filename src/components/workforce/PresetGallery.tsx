"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Repeat, Gift, Clock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CAPABILITY_PRESETS,
  createCapabilityPresetDraft,
  type CapabilityPresetId,
} from "@/lib/capability-presets";
import { type PermissionDraft } from "@/lib/agent-permissions";

type PresetGalleryProps = {
  onHirePreset?: (draft: PermissionDraft) => void;
};

const INITIAL_PRESET_COUNT = 3;

const PRESET_CARDS = {
  "stablecoin-assistant": {
    icon: Coins,
    iconColor: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    code: "P.01",
  },
  "defi-rebalancer": {
    icon: Repeat,
    iconColor: "text-primary border-primary/40 bg-primary/10",
    code: "P.02",
  },
  "rewards-claimer": {
    icon: Gift,
    iconColor: "text-accent border-accent/30 bg-accent/10",
    code: "P.03",
  },
  "treasury-payer": {
    icon: Coins,
    iconColor: "text-foreground border-border bg-secondary",
    code: "P.04",
  },
  "gas-runner": {
    icon: Repeat,
    iconColor: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    code: "P.05",
  },
  "governance-voter": {
    icon: Gift,
    iconColor: "text-foreground border-border bg-secondary",
    code: "P.06",
  },
} satisfies Record<CapabilityPresetId, {
  icon: typeof Coins;
  iconColor: string;
  code: string;
}>;

export function PresetGallery({ onHirePreset }: PresetGalleryProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_PRESET_COUNT);
  const visiblePresets = useMemo(
    () => CAPABILITY_PRESETS.slice(0, visibleCount),
    [visibleCount],
  );
  const hasMorePresets = visibleCount < CAPABILITY_PRESETS.length;

  return (
    <section className="container pb-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <span className="num-pin">03 / Capability Presets</span>
          <h3 className="text-[clamp(1.5rem,2.6vw,2.25rem)] font-semibold leading-tight tracking-tightest">
            Curated policies, <span className="editorial text-accent">ready</span> to deploy.
          </h3>
        </div>
        <Badge variant="muted">Ready to hire</Badge>
      </div>
      <div className="grid gap-0 border-t border-border/60 md:grid-cols-2 lg:grid-cols-3">
        {visiblePresets.map(({ id, title, role, budget, expires }, i) => {
          const { icon: Icon, iconColor, code } = PRESET_CARDS[id];

          return (
            <motion.article
              key={id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative border-b border-r border-border/60 p-7 transition-colors hover:bg-secondary/20 lg:[&:nth-child(3n)]:border-r-0 [&:nth-last-child(-n+3)]:border-b-0 max-md:[&:nth-last-child(-n+3)]:border-b max-lg:[&:nth-last-child(-n+3)]:border-b"
            >
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-sm ${iconColor}`}>
                    <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.5} />
                  </span>
                  <span className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground">
                    {code}
                  </span>
                </div>
                <div>
                  <h4 className="text-[1.0625rem] font-semibold tracking-tight">{title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{role}</p>
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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => onHirePreset?.(createCapabilityPresetDraft(id))}
                  disabled={!onHirePreset}
                >
                  Hire with this preset
                </Button>
              </div>
            </motion.article>
          );
        })}
      </div>
      {hasMorePresets ? (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVisibleCount((current) =>
                Math.min(current + INITIAL_PRESET_COUNT, CAPABILITY_PRESETS.length),
              )
            }
          >
            <Plus className="h-4 w-4" />
            Load more capability presets
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[0.8125rem] font-medium">{value}</span>
    </div>
  );
}
