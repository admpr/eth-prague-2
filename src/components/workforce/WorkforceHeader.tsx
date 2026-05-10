"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, ShieldCheck, Wallet, Users, Coins, CircleDollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BASE_SEPOLIA_EXPLORER_ADDRESS } from "@/lib/config";
import { shortAddress } from "@/lib/utils";
import { formatEth, formatUsdc, getAccountBalances } from "@/lib/balances";

type WorkforceHeaderProps = {
  authority?: string;
  activeEmployees?: number;
};

export function WorkforceHeader({ authority, activeEmployees = 0 }: WorkforceHeaderProps) {
  const [balances, setBalances] = useState<{ eth: string; usdc: string } | null>(null);

  useEffect(() => {
    if (!authority) return;
    let cancelled = false;
    void (async () => {
      try {
        const { ethWei, usdc } = await getAccountBalances(authority as `0x${string}`);
        if (cancelled) return;
        setBalances({ eth: formatEth(ethWei), usdc: formatUsdc(usdc) });
      } catch {
        if (!cancelled) setBalances({ eth: "—", usdc: "—" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authority]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container pt-10"
    >
      <div className="rounded-xl surface-glow p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-3">
              <span className="num-pin">Workforce / Live</span>
              <Badge variant="success">
                <ShieldCheck className="h-3.5 w-3.5" /> Delegation active
              </Badge>
            </div>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-[0.98] tracking-tightest">
              Welcome to your <span className="editorial text-accent">workforce.</span>
            </h1>
            <p className="max-w-md text-muted-foreground">
              Your wallet is now a smart account. Create scoped access keys, set their budgets, and
              revoke them with a click.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <Tile
              icon={Wallet}
              iconClass="text-primary bg-primary/10 border border-primary/30"
              label="Account"
              value={authority ? shortAddress(authority, 8, 6) : "—"}
              href={authority ? `${BASE_SEPOLIA_EXPLORER_ADDRESS}/${authority}` : undefined}
              mono
            />
            <Tile
              icon={Users}
              iconClass="text-foreground bg-secondary border border-border"
              label="Active employees"
              value={activeEmployees.toString()}
              hint={activeEmployees === 0 ? "None hired yet" : undefined}
            />
            <Tile
              icon={Coins}
              iconClass="text-foreground/80 bg-secondary border border-border"
              label="ETH balance"
              value={balances ? `${balances.eth} ETH` : null}
            />
            <Tile
              icon={CircleDollarSign}
              iconClass="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
              label="USDC balance"
              value={balances ? `${balances.usdc} USDC` : null}
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Tile({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
  href,
  mono,
}: {
  icon: typeof Wallet;
  iconClass: string;
  label: string;
  value: string | null;
  hint?: string;
  href?: string;
  mono?: boolean;
}) {
  const content = (
    <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-secondary/50 h-full">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${iconClass}`}>
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 text-base ${mono ? "font-mono" : "font-semibold tracking-tight"}`}>
          {value === null ? (
            <span className="inline-block h-5 w-24 animate-pulse rounded bg-secondary" />
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {value}
              {href ? <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> : null}
            </span>
          )}
        </div>
        {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {content}
      </a>
    );
  }
  return content;
}
