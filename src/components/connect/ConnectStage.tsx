"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bluetooth, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFireflyDelegation } from "@/hooks/useFireflyDelegation";
import { ProgressModal } from "@/components/connect/ProgressModal";
import { HardwareWalletArt } from "@/components/shared/HardwareWalletArt";
import { shortAddress } from "@/lib/utils";
import { isPlaceholderDelegate, DELEGATE_CONTRACT_ADDRESS } from "@/lib/config";

export function ConnectStage() {
  const router = useRouter();
  const { state, connect, delegate, reset } = useFireflyDelegation();
  const [bluetoothSupported, setBluetoothSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setBluetoothSupported(typeof navigator !== "undefined" && "bluetooth" in navigator);
  }, []);

  useEffect(() => {
    if (state.step === "confirmed" && state.result) {
      const params = new URLSearchParams({
        hash: state.result.hash,
        authority: state.result.authority,
        delegate: state.result.delegateContract,
        block: state.result.blockNumber,
      });
      const t = setTimeout(() => router.push(`/workforce?${params.toString()}`), 1200);
      return () => clearTimeout(t);
    }
  }, [state.step, state.result, router]);

  const isConnecting = state.step === "connecting";
  const isConnected =
    state.step === "connected" ||
    state.step === "preparing" ||
    state.step === "awaitingDevice" ||
    state.step === "verifying" ||
    state.step === "broadcasting" ||
    state.step === "confirmed";

  const placeholder = isPlaceholderDelegate();

  return (
    <section className="container grid items-center gap-12 py-12 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-8">
        <div>
          <Badge variant="primary">
            <Bluetooth className="h-3.5 w-3.5" /> Web Bluetooth required
          </Badge>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            One signature.
            <br />
            <span className="text-gradient">Smart account, instantly.</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Connect your hardware wallet, then approve a single EIP-7702 authorization. We handle
            the nonce, broadcast, and confirmation behind the scenes.
          </p>
        </div>

        {bluetoothSupported === false ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Web Bluetooth isn't available in this browser. Open this page in Chrome or Edge on a
            desktop OS to continue.
          </div>
        ) : null}

        {placeholder ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <strong className="font-semibold">Configuration needed.</strong> Edit{" "}
            <code className="font-mono text-xs">src/lib/config.ts</code> and set{" "}
            <code className="font-mono text-xs">DELEGATE_CONTRACT_ADDRESS</code> to the smart-account
            implementation address before running this flow.
          </div>
        ) : null}

        <motion.div
          layout
          className="rounded-2xl surface-glow p-6 space-y-6"
          transition={{ duration: 0.4, type: "spring", stiffness: 220, damping: 26 }}
        >
          <Step
            n={1}
            title="Connect hardware wallet"
            done={isConnected}
            active={!isConnected}
            description={
              state.device
                ? `Paired · S/N ${state.device.serial}`
                : "Pair your hardware wallet over Bluetooth."
            }
          />
          {!isConnected ? (
            <Button
              size="lg"
              className="w-full"
              onClick={connect}
              disabled={isConnecting || bluetoothSupported === false}
            >
              {isConnecting ? "Pairing…" : "Connect hardware wallet"}
              {!isConnecting ? <ChevronRight className="h-4 w-4" /> : null}
            </Button>
          ) : null}

          {isConnected && state.device ? (
            <>
              <div className="rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm">
                <div className="text-muted-foreground text-xs uppercase tracking-wider">
                  Connected wallet
                </div>
                <div className="mt-1 font-mono text-base">
                  {shortAddress(state.device.address, 10, 8)}
                </div>
              </div>

              <Step
                n={2}
                title="Sign & activate delegation"
                done={state.step === "confirmed"}
                active={state.step !== "confirmed"}
                description={
                  <>
                    Delegating to{" "}
                    <span className="font-mono">{shortAddress(DELEGATE_CONTRACT_ADDRESS, 8, 6)}</span>{" "}
                    on Base Sepolia. Approve once on-device, and we'll do the rest.
                  </>
                }
              />

              <Button
                size="lg"
                className="w-full"
                onClick={delegate}
                disabled={
                  state.step === "preparing" ||
                  state.step === "awaitingDevice" ||
                  state.step === "verifying" ||
                  state.step === "broadcasting" ||
                  state.step === "confirmed" ||
                  placeholder
                }
              >
                <Sparkles className="h-4 w-4" />
                Sign & Activate Delegation
              </Button>
            </>
          ) : null}
        </motion.div>

        <p className="text-xs text-muted-foreground/80 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          Your hardware wallet always signs the high-authority action. The relayer only pays gas.
        </p>
      </div>

      <div className="relative">
        <HardwareWalletArt />
      </div>

      <ProgressModal state={state} onClose={reset} onRetry={reset} onContinue={() => {
        if (state.result) {
          const params = new URLSearchParams({
            hash: state.result.hash,
            authority: state.result.authority,
            delegate: state.result.delegateContract,
            block: state.result.blockNumber,
          });
          router.push(`/workforce?${params.toString()}`);
        }
      }} />
    </section>
  );
}

function Step({
  n,
  title,
  description,
  done,
  active,
}: {
  n: number;
  title: string;
  description: React.ReactNode;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
          done
            ? "bg-emerald-500/15 text-emerald-400"
            : active
              ? "bg-primary/15 text-primary"
              : "bg-secondary text-muted-foreground"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
