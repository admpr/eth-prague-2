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
    accent: "from-emerald-500/20 to-emerald-500/0",
    iconColor: "text-emerald-400",
  },
  "defi-rebalancer": {
    icon: Repeat,
    accent: "from-primary/20 to-primary/0",
    iconColor: "text-primary",
  },
  "rewards-claimer": {
    icon: Gift,
    accent: "from-accent/20 to-accent/0",
    iconColor: "text-accent",
  },
  "treasury-payer": {
    icon: Coins,
    accent: "from-sky-500/20 to-sky-500/0",
    iconColor: "text-sky-300",
  },
  "gas-runner": {
    icon: Repeat,
    accent: "from-amber-500/20 to-amber-500/0",
    iconColor: "text-amber-300",
  },
  "governance-voter": {
    icon: Gift,
    accent: "from-rose-500/20 to-rose-500/0",
    iconColor: "text-rose-300",
  },
} satisfies Record<CapabilityPresetId, {
  icon: typeof Coins;
  accent: string;
  iconColor: string;
}>;

export function PresetGallery({ onHirePreset }: PresetGalleryProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_PRESET_COUNT);
  const visiblePresets = useMemo(
    () => CAPABILITY_PRESETS.slice(0, visibleCount),
    [visibleCount],
  );
  const hasMorePresets = visibleCount < CAPABILITY_PRESETS.length;

  return (
    <section className="container pb-20">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">Capability presets</h3>
          <p className="text-sm text-muted-foreground">
            Curated policies for common agent jobs, ready to confirm or tune.
          </p>
        </div>
        <Badge variant="muted">Ready to hire</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {visiblePresets.map(({ id, title, role, budget, expires }, i) => {
          const { icon: Icon, accent, iconColor } = PRESET_CARDS[id];

          return (
            <motion.article
              key={id}
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
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
