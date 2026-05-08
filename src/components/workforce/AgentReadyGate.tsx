"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FireflyClient } from "@/lib/firefly/firefly-client";
import { bytesToHex } from "@/lib/firefly/hex";
import {
  buildAgentReadyCacheKey,
  buildAgentReadyCookieName,
  buildInstallAgentPermissionValidatorCalldata,
  checkAgentReadyWallet,
  fromFireflyTransactionSignature,
  getConfiguredAgentPermissionValidatorAddress,
  serializeSignedFireflyTransaction,
  toFireflyTransactionParams,
  type AgentReadyResult,
  type AgentReadyStatus,
  type FireflyTransactionRequest,
} from "@/lib/kernel-modules";
import { getPendingNonce, baseSepoliaPublicClient } from "@/lib/rpc";
import {
  DELEGATE_CONTRACT_ADDRESS,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EXPLORER_TX,
} from "@/lib/config";
import { shortAddress } from "@/lib/utils";

type AgentReadyGateProps = {
  authority?: string;
  initialReady?: boolean;
  children: React.ReactNode;
};

type ActivationStep =
  | "idle"
  | "connecting"
  | "preparing"
  | "awaitingDevice"
  | "broadcasting"
  | "confirmed"
  | "error";

const statusCopy: Record<AgentReadyStatus, { title: string; body: string }> = {
  "missing-authority": {
    title: "Connect your hardware wallet first",
    body: "The workforce screen needs the delegated wallet address to check agent readiness.",
  },
  "missing-validator-config": {
    title: "Validator address is not configured",
    body: "Set NEXT_PUBLIC_AGENT_PERMISSION_VALIDATOR_ADDRESS to the Base Sepolia AgentPermissionValidator address.",
  },
  "invalid-validator-config": {
    title: "Validator address is invalid",
    body: "NEXT_PUBLIC_AGENT_PERMISSION_VALIDATOR_ADDRESS must be a valid EVM address.",
  },
  "delegation-missing": {
    title: "Delegation is not active",
    body: "This address is not currently delegated to the expected Kernel 3.3 implementation.",
  },
  "validator-missing": {
    title: "Activate agent-ready wallet",
    body: "Install the AgentPermissionValidator module before hiring AI employees.",
  },
  ready: {
    title: "Agent-ready wallet active",
    body: "The permission validator is installed and ready for scoped employee keys.",
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readCachedReadiness(authority: Address | undefined): AgentReadyResult | null {
  const validatorAddress = getConfiguredAgentPermissionValidatorAddress();
  if (!authority || !validatorAddress || typeof window === "undefined") return null;

  const key = buildAgentReadyCacheKey({
    authority,
    delegate: DELEGATE_CONTRACT_ADDRESS,
    validator: validatorAddress,
  });
  return window.localStorage.getItem(key) === "ready"
    ? { status: "ready", validatorAddress }
    : null;
}

function writeCachedReadiness(authority: Address | undefined, validatorAddress: Address | undefined) {
  if (!authority || !validatorAddress || typeof window === "undefined") return;

  const cacheOptions = {
    authority,
    delegate: DELEGATE_CONTRACT_ADDRESS,
    validator: validatorAddress,
  };
  window.localStorage.setItem(buildAgentReadyCacheKey(cacheOptions), "ready");
  document.cookie = `${buildAgentReadyCookieName(cacheOptions)}=ready; path=/; max-age=31536000; samesite=lax`;
}

export function AgentReadyGate({ authority, initialReady = false, children }: AgentReadyGateProps) {
  const normalizedAuthority = useMemo(() => {
    if (!authority || !isAddress(authority)) return undefined;
    return getAddress(authority);
  }, [authority]);
  const [readiness, setReadiness] = useState<AgentReadyResult | null>(() =>
    initialReady
      ? {
          status: "ready",
          validatorAddress: getConfiguredAgentPermissionValidatorAddress(),
        }
      : readCachedReadiness(normalizedAuthority),
  );
  const [checkError, setCheckError] = useState<string | undefined>();
  const [activationStep, setActivationStep] = useState<ActivationStep>("idle");
  const [activationError, setActivationError] = useState<string | undefined>();
  const [pendingHash, setPendingHash] = useState<Hex | undefined>();
  const fireflyRef = useRef<FireflyClient | undefined>(undefined);

  useEffect(() => {
    if (initialReady) return;
    const cached = readCachedReadiness(normalizedAuthority);
    if (cached) setReadiness(cached);
  }, [initialReady, normalizedAuthority]);

  const refreshReadiness = useCallback(async (): Promise<AgentReadyResult | null> => {
    setCheckError(undefined);
    try {
      const result = await checkAgentReadyWallet(baseSepoliaPublicClient, normalizedAuthority);
      setReadiness(result);
      if (result.status === "ready") {
        writeCachedReadiness(normalizedAuthority, result.validatorAddress);
      }
      return result;
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : String(error));
      setReadiness(null);
      return null;
    }
  }, [normalizedAuthority]);

  const waitForReadyWallet = useCallback(async (): Promise<AgentReadyResult | null> => {
    let latest: AgentReadyResult | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      latest = await refreshReadiness();
      if (latest?.status === "ready") return latest;
      await sleep(1500);
    }
    return latest;
  }, [refreshReadiness]);

  useEffect(() => {
    if (readiness?.status === "ready") return;
    void refreshReadiness();
  }, [readiness?.status, refreshReadiness]);

  useEffect(() => {
    return () => {
      void fireflyRef.current?.destroy().catch(() => undefined);
    };
  }, []);

  const activate = useCallback(async () => {
    if (!normalizedAuthority || !readiness?.validatorAddress) return;

    setActivationStep("connecting");
    setActivationError(undefined);
    setPendingHash(undefined);
    try {
      const firefly = await FireflyClient.discover(true);
      fireflyRef.current = firefly;

      const accounts = await firefly.sendMessage("ffx_accounts", []);
      if (!Array.isArray(accounts) || !(accounts[0] instanceof Uint8Array)) {
        throw new Error("Hardware wallet returned an invalid account response");
      }
      const deviceAddress = getAddress(bytesToHex(accounts[0]));
      if (deviceAddress !== normalizedAuthority) {
        throw new Error(
          `Connected wallet ${shortAddress(deviceAddress)} does not match ${shortAddress(normalizedAuthority)}`,
        );
      }

      setActivationStep("preparing");
      const data = buildInstallAgentPermissionValidatorCalldata(readiness.validatorAddress);
      const nonce = await getPendingNonce(normalizedAuthority);
      const fees = await baseSepoliaPublicClient.estimateFeesPerGas();
      const estimatedGas = await baseSepoliaPublicClient.estimateGas({
        account: normalizedAuthority,
        to: normalizedAuthority,
        value: 0n,
        data,
      });

      const tx: FireflyTransactionRequest = {
        chainId: BigInt(BASE_SEPOLIA_CHAIN_ID),
        nonce,
        gasLimit: estimatedGas + estimatedGas / 5n + 10_000n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        to: normalizedAuthority,
        value: 0n,
        data,
      };

      setActivationStep("awaitingDevice");
      const rawSignature = await firefly.sendMessage(
        "ffx_signTransaction",
        toFireflyTransactionParams(tx),
      );
      const rawTransaction = serializeSignedFireflyTransaction(
        tx,
        fromFireflyTransactionSignature(rawSignature),
      );

      setActivationStep("broadcasting");
      const response = await fetch("/api/broadcast-raw-transaction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawTransaction }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? `Broadcast failed (HTTP ${response.status})`);
      }

      const hash = payload.hash as Hex;
      setPendingHash(hash);
      const receipt = await baseSepoliaPublicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 2000,
        retryCount: 60,
        retryDelay: 2000,
      });
      if (receipt.status !== "success") {
        throw new Error("Module installation transaction reverted on chain");
      }

      const finalReadiness = await waitForReadyWallet();
      if (finalReadiness?.status !== "ready") {
        throw new Error("Transaction confirmed, but the validator is not visible yet. Try Refresh in a few seconds.");
      }
      setActivationStep("confirmed");
    } catch (error) {
      setActivationStep("error");
      setActivationError(error instanceof Error ? error.message : String(error));
    }
  }, [normalizedAuthority, readiness?.validatorAddress, waitForReadyWallet]);

  if (readiness?.status === "ready") {
    return <>{children}</>;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="container py-10"
    >
      <div className="rounded-2xl surface-glow p-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <Badge variant={readiness?.status === "validator-missing" ? "primary" : "muted"}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Agent readiness check
            </Badge>

            <div className="space-y-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                {readiness ? statusCopy[readiness.status].title : "Checking wallet readiness"}
              </h1>
              <p className="max-w-xl text-muted-foreground">
                {checkError
                  ? checkError
                  : readiness
                    ? statusCopy[readiness.status].body
                    : "Checking the delegated Kernel wallet for the AgentPermissionValidator module."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {readiness?.status === "validator-missing" ? (
                <Button
                  size="lg"
                  onClick={activate}
                  disabled={
                    activationStep === "connecting" ||
                    activationStep === "preparing" ||
                    activationStep === "awaitingDevice" ||
                    activationStep === "broadcasting"
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  {activationStep === "idle" || activationStep === "error"
                    ? "Activate agent-ready wallet"
                    : activationLabel(activationStep)}
                </Button>
              ) : null}

              {readiness?.status === "missing-authority" ||
              readiness?.status === "delegation-missing" ? (
                <Button asChild size="lg">
                  <a href="/connect">
                    <Wallet className="h-4 w-4" />
                    Connect wallet
                  </a>
                </Button>
              ) : null}

              <Button variant="outline" size="lg" onClick={refreshReadiness}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            {activationError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {activationError}
              </div>
            ) : null}

            {pendingHash ? (
              <a
                href={`${BASE_SEPOLIA_EXPLORER_TX}/${pendingHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent"
              >
                View activation transaction <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>

          <div className="space-y-3">
            <StatusRow
              done={Boolean(normalizedAuthority)}
              active={!normalizedAuthority}
              label="Wallet address"
              value={normalizedAuthority ? shortAddress(normalizedAuthority, 8, 6) : "Missing"}
            />
            <StatusRow
              done={readiness?.status !== "delegation-missing" && readiness?.status !== "missing-authority"}
              active={readiness?.status === "delegation-missing"}
              label="Kernel 3.3 delegation"
              value={shortAddress(DELEGATE_CONTRACT_ADDRESS, 8, 6)}
            />
            <StatusRow
              done={activationStep === "confirmed"}
              active={readiness?.status === "validator-missing"}
              label="Permission validator"
              value={
                readiness?.validatorAddress
                  ? shortAddress(readiness.validatorAddress, 8, 6)
                  : "Not configured"
              }
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function activationLabel(step: ActivationStep): string {
  switch (step) {
    case "connecting":
      return "Connecting hardware wallet";
    case "preparing":
      return "Preparing transaction";
    case "awaitingDevice":
      return "Approve on hardware wallet";
    case "broadcasting":
      return "Broadcasting on Base Sepolia";
    case "confirmed":
      return "Activated";
    default:
      return "Activate agent-ready wallet";
  }
}

function StatusRow({
  done,
  active,
  label,
  value,
}: {
  done: boolean;
  active: boolean;
  label: string;
  value: string;
}) {
  const Icon = done ? CheckCircle2 : active ? Cpu : AlertTriangle;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          done
            ? "bg-emerald-500/10 text-emerald-400"
            : active
              ? "bg-primary/10 text-primary"
              : "bg-amber-500/10 text-amber-300"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 truncate font-mono text-sm">{value}</div>
      </div>
    </div>
  );
}
