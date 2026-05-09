"use client";

import { type ReactNode } from "react";
import { Coins, Infinity, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatLimitAmount,
  type AgentEmployee,
} from "@/hooks/useAgentPermissionState";

export function PermissionSummary({ employee }: { employee: AgentEmployee }) {
  const now = Math.floor(Date.now() / 1000);
  const status = statusBadge(employee, now);
  const enabledTokenLimits = employee.tokenLimits.filter((limit) => limit.enabled);
  const nativeLimit = employee.nativeLimitEnabled
    ? `${formatLimitAmount(employee.nativeLimit.amount, 18)} ETH / ${periodLabel(
        employee.nativeLimit.period,
      )}`
    : "ETH spend disabled";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant={status.variant}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {status.label}
        </Badge>

        {employee.requireAllowedCall ? (
          <Badge variant="primary">
            <LockKeyhole className="h-3.5 w-3.5" />
            Whitelist only
          </Badge>
        ) : (
          <Badge variant="accent">
            <Infinity className="h-3.5 w-3.5" />
            Any contract
          </Badge>
        )}
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <SummaryRow
          icon={<Coins className="h-3.5 w-3.5 text-muted-foreground" />}
          label="ETH"
          value={nativeLimit}
        />
        <SummaryRow label="Window" value={validityLabel(employee)} />
      </dl>

      <dl className="space-y-2 text-sm">
        {enabledTokenLimits.length > 0 ? (
          enabledTokenLimits.map((limit) => (
            <SummaryRow
              key={limit.token}
              label={limit.symbol}
              value={`${formatLimitAmount(limit.limit.amount, limit.decimals)} / ${periodLabel(
                limit.limit.period,
              )}`}
            />
          ))
        ) : (
          <SummaryRow label="Tokens" value="No ERC20 spend budgets" />
        )}
      </dl>
    </div>
  );
}

function statusBadge(
  employee: AgentEmployee,
  now: number,
): { label: string; variant: "muted" | "primary" | "success" } {
  if (!employee.active) return { label: "Inactive", variant: "muted" };
  if (employee.validAfter !== 0 && now < employee.validAfter) {
    return { label: "Scheduled", variant: "primary" };
  }
  if (employee.expired) return { label: "Expired", variant: "muted" };
  return { label: "Active", variant: "success" };
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
      <dt className="flex min-w-0 items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function periodLabel(period: number): string {
  if (period === 0) return "fixed";
  if (period === 3600) return "hour";
  if (period === 86400) return "day";
  if (period === 604800) return "week";
  return `${period}s`;
}

function validityLabel(employee: AgentEmployee): string {
  const start = employee.validAfter === 0 ? undefined : formatTimestamp(employee.validAfter);
  const end = employee.validUntil === 0 ? undefined : formatTimestamp(employee.validUntil);

  if (!start && !end) return "No expiry";
  if (start && !end) return `From ${start}`;
  if (!start && end) return `Until ${end}`;
  return `${start} - ${end}`;
}

function formatTimestamp(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
