"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, AlertTriangle, Cpu, ShieldCheck, Radio, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DelegationState, DelegationStep } from "@/hooks/useFireflyDelegation";
import { cn, shortAddress } from "@/lib/utils";
import { BASE_SEPOLIA_EXPLORER_TX } from "@/lib/config";
import { ExternalLink } from "lucide-react";

type StepDef = {
  id: Exclude<DelegationStep, "idle" | "connecting" | "connected" | "error">;
  label: string;
  hint: string;
  Icon: typeof Cpu;
};

const STEPS: StepDef[] = [
  { id: "preparing", label: "Reading on-chain context", hint: "Fetching Base Sepolia chain ID and your pending nonce.", Icon: Radio },
  { id: "awaitingDevice", label: "Approve on your hardware wallet", hint: "Confirm the EIP-7702 authorization on the device screen.", Icon: Cpu },
  { id: "verifying", label: "Verifying signature", hint: "Recovering the signer to make sure it matches your hardware wallet.", Icon: ShieldCheck },
  { id: "broadcasting", label: "Broadcasting on Base Sepolia", hint: "Submitting the type-4 transaction and waiting for confirmation.", Icon: Sparkles },
  { id: "confirmed", label: "Wallet delegated", hint: "Your EOA now runs the smart-account code path.", Icon: CheckCircle2 },
];

const STEP_ORDER: Record<StepDef["id"], number> = STEPS.reduce(
  (acc, step, i) => ({ ...acc, [step.id]: i }),
  {} as Record<StepDef["id"], number>,
);

function statusOf(stepId: StepDef["id"], current: DelegationStep): "done" | "active" | "pending" {
  if (current === "error" || current === "idle" || current === "connecting" || current === "connected") {
    return "pending";
  }
  const target = STEP_ORDER[stepId];
  const at = STEP_ORDER[current as StepDef["id"]];
  if (at == null) return "pending";
  if (at > target) return "done";
  if (at === target) return "active";
  return "pending";
}

export function ProgressModal({
  state,
  onClose,
  onRetry,
  onContinue,
}: {
  state: DelegationState;
  onClose: () => void;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const open =
    state.step === "preparing" ||
    state.step === "awaitingDevice" ||
    state.step === "verifying" ||
    state.step === "broadcasting" ||
    state.step === "confirmed" ||
    state.step === "error";

  const isTerminal = state.step === "confirmed" || state.step === "error";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && isTerminal) onClose();
      }}
    >
      <DialogContent className="max-w-xl">
        <div className="flex items-center gap-3">
          {state.step === "error" ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
          ) : state.step === "confirmed" ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          )}
          <div>
            <DialogTitle>
              {state.step === "error"
                ? "Something went wrong"
                : state.step === "confirmed"
                  ? "Delegation activated"
                  : "Activating delegation"}
            </DialogTitle>
            <DialogDescription>
              {state.step === "error"
                ? "Review the error below and try again."
                : "We're orchestrating the EIP-7702 flow with your hardware wallet."}
            </DialogDescription>
          </div>
        </div>

        <ol className="mt-2 space-y-3">
          {STEPS.map(({ id, label, hint, Icon }) => {
            const status = statusOf(id, state.step);
            return (
              <li
                key={id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                  status === "active" && "border-primary/50 bg-primary/5",
                  status === "done" && "border-emerald-500/30 bg-emerald-500/5",
                  status === "pending" && "border-border/60 bg-secondary/20",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    status === "active" && "bg-primary/20 text-primary",
                    status === "done" && "bg-emerald-500/20 text-emerald-400",
                    status === "pending" && "bg-secondary text-muted-foreground",
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {status === "active" ? (
                      <motion.span
                        key="active"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </motion.span>
                    ) : status === "done" ? (
                      <motion.span
                        key="done"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </motion.span>
                    ) : (
                      <motion.span key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Icon className="h-4 w-4" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </div>
              </li>
            );
          })}
        </ol>

        {state.pendingHash ? (
          <a
            href={`${BASE_SEPOLIA_EXPLORER_TX}/${state.pendingHash}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm transition-colors hover:border-accent/40 hover:bg-secondary/60"
          >
            <span className="text-muted-foreground text-xs uppercase tracking-wider">
              Transaction
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-foreground">
              {shortAddress(state.pendingHash, 10, 8)}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </span>
          </a>
        ) : null}

        {state.step === "error" && state.error ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <div className="flex gap-2 justify-end pt-2">
          {state.step === "error" ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onRetry}>Try again</Button>
            </>
          ) : state.step === "confirmed" ? (
            <Button onClick={onContinue}>Continue to your workforce</Button>
          ) : (
            <Button variant="ghost" disabled>
              Working…
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
