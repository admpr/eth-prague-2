"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress } from "viem";
import { FireflyClient } from "@/lib/firefly/firefly-client";
import {
  fromFireflyAuthorizationResult,
  recoverAuthorizationSigner,
  toFireflyAuthorizationParams,
  type AuthorizationRequest,
  type AuthorizationSignature,
} from "@/lib/firefly/eip7702";
import { bytesToHex } from "@/lib/firefly/hex";
import {
  DELEGATE_CONTRACT_ADDRESS,
  BASE_SEPOLIA_CHAIN_ID,
  isPlaceholderDelegate,
} from "@/lib/config";
import {
  getPendingNonce,
  baseSepoliaPublicClient,
  waitForSubmittedTransactionReceipt,
  SUBMITTED_TRANSACTION_RECEIPT_POLLING_INTERVAL_MS,
  SUBMITTED_TRANSACTION_RECEIPT_TIMEOUT_MS,
} from "@/lib/rpc";
import { codeMatchesDelegate } from "@/lib/delegation";

export type DelegationStep =
  | "idle"
  | "connecting"
  | "connected"
  | "preparing"
  | "awaitingDevice"
  | "verifying"
  | "broadcasting"
  | "confirmed"
  | "error";

export type DelegationResult = {
  hash: string;
  authority: string;
  delegateContract: string;
  blockNumber: string;
};

type DeviceInfo = {
  serial: number;
  address: string;
};

export type DelegationState = {
  step: DelegationStep;
  device?: DeviceInfo;
  pendingHash?: string;
  error?: string;
  result?: DelegationResult;
};

export function useFireflyDelegation() {
  const [state, setState] = useState<DelegationState>({ step: "idle" });
  const fireflyRef = useRef<FireflyClient | undefined>(undefined);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      void fireflyRef.current?.destroy().catch(() => undefined);
    };
  }, []);

  const reset = useCallback(() => {
    void fireflyRef.current?.destroy().catch(() => undefined);
    fireflyRef.current = undefined;
    setState({ step: "idle" });
  }, []);

  const connect = useCallback(async () => {
    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      setState({
        step: "error",
        error:
          "Web Bluetooth isn't available in this browser. Use Chrome or Edge on a desktop OS.",
      });
      return;
    }

    setState({ step: "connecting" });
    try {
      const client = await FireflyClient.discover(true);
      fireflyRef.current = client;
      client.ondisconnect = () => {
        fireflyRef.current = undefined;
        setState((prev) =>
          prev.step === "confirmed" ? prev : { step: "error", error: "Hardware wallet disconnected." },
        );
      };

      const result = await client.sendMessage("ffx_accounts", []);
      if (!Array.isArray(result) || !(result[0] instanceof Uint8Array)) {
        throw new Error("Hardware wallet returned an invalid account response");
      }
      const address = getAddress(bytesToHex(result[0]));

      setState({
        step: "connected",
        device: { serial: client.serialNumber, address },
      });
    } catch (error) {
      await fireflyRef.current?.destroy().catch(() => undefined);
      fireflyRef.current = undefined;
      setState({
        step: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const delegate = useCallback(async () => {
    const firefly = fireflyRef.current;
    const device = state.device;
    if (!firefly || !device) {
      setState({ step: "error", error: "Connect a hardware wallet first" });
      return;
    }
    if (isPlaceholderDelegate()) {
      setState({
        step: "error",
        error:
          "DELEGATE_CONTRACT_ADDRESS is not configured. Edit src/lib/config.ts before running the flow.",
      });
      return;
    }

    setState({ step: "preparing", device });
    let pendingHash: `0x${string}` | undefined;
    try {
      const delegateContract = getAddress(DELEGATE_CONTRACT_ADDRESS);
      logDelegation("Starting EIP-7702 delegation flow", {
        authority: device.address,
        delegateContract,
      });
      const onchainChainId = await baseSepoliaPublicClient.getChainId();
      if (onchainChainId !== BASE_SEPOLIA_CHAIN_ID) {
        throw new Error(
          `Base Sepolia RPC returned chainId ${onchainChainId}, expected ${BASE_SEPOLIA_CHAIN_ID}`,
        );
      }
      const nonce = await getPendingNonce(device.address as `0x${string}`);
      logDelegation("Read on-chain context", {
        chainId: onchainChainId,
        expectedChainId: BASE_SEPOLIA_CHAIN_ID,
        nonce: nonce.toString(),
      });

      const request: AuthorizationRequest = {
        chainId: BigInt(BASE_SEPOLIA_CHAIN_ID),
        contractAddress: delegateContract,
        nonce,
      };

      setState({ step: "awaitingDevice", device });
      logDelegation("Waiting for hardware wallet authorization approval", {
        authority: device.address,
        delegateContract: request.contractAddress,
        nonce: request.nonce.toString(),
      });
      const raw = await firefly.sendMessage(
        "ffx_signAuthorization",
        toFireflyAuthorizationParams(request),
      );
      const signature: AuthorizationSignature = fromFireflyAuthorizationResult(request, raw);
      logDelegation("Received authorization signature from hardware wallet");

      setState({ step: "verifying", device });
      logDelegation("Recovering authorization signer");
      const recovered = await recoverAuthorizationSigner(signature);
      if (getAddress(recovered) !== getAddress(device.address)) {
        throw new Error(`Signature recovered ${recovered}, expected ${device.address}`);
      }
      logDelegation("Authorization signer verified", { recovered: getAddress(recovered) });

      setState({ step: "broadcasting", device });
      logDelegation("Broadcasting authorization through local relayer API", {
        authority: device.address,
        delegateContract: signature.contractAddress,
        nonce: signature.nonce.toString(),
      });
      const response = await fetch("/api/broadcast-authorization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authorityAddress: device.address,
          authorization: {
            chainId: signature.chainId.toString(),
            contractAddress: signature.contractAddress,
            nonce: signature.nonce.toString(),
            yParity: signature.yParity,
            r: signature.r,
            s: signature.s,
          },
        }),
      });
      const payload = await response.json();
      logDelegation("Broadcast API responded", {
        ok: response.ok,
        status: response.status,
      });
      if (!response.ok) {
        logDelegationError("Broadcast API rejected authorization", payload.error);
        throw new Error(payload.error ?? `Broadcast failed (HTTP ${response.status})`);
      }
      const hash = payload.hash as `0x${string}`;
      if (!hash) {
        throw new Error("Broadcast did not return a transaction hash");
      }
      pendingHash = hash;

      setState({ step: "broadcasting", device, pendingHash: hash });

      // Poll receipt client-side. Public RPCs occasionally drop long-running
      // server requests, so we keep the client in control of waiting.
      const stopWaitingLog = startReceiptWaitLog(hash);
      const receipt = await waitForSubmittedTransactionReceipt({ hash }).finally(stopWaitingLog);
      logDelegation("Transaction receipt received", {
        hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
      });

      if (receipt.status !== "success") {
        throw new Error("Broadcast transaction reverted on chain");
      }

      logDelegation("Checking delegated account code", {
        authority: device.address,
        delegateContract,
      });
      const code = await baseSepoliaPublicClient.getCode({
        address: device.address as `0x${string}`,
      });
      if (!codeMatchesDelegate(code, DELEGATE_CONTRACT_ADDRESS)) {
        throw new Error("Delegation not detected on the authority address after confirmation");
      }
      logDelegation("Delegation code detected on authority address", {
        authority: device.address,
        hash,
      });

      if (cancelledRef.current) {
        logDelegation("Skipping confirmed state because delegation hook is unmounted", { hash });
        return;
      }
      setState({
        step: "confirmed",
        device,
        pendingHash: hash,
        result: {
          hash,
          authority: device.address,
          delegateContract: getAddress(DELEGATE_CONTRACT_ADDRESS),
          blockNumber: receipt.blockNumber.toString(),
        },
      });
    } catch (error) {
      logDelegationError("Delegation flow failed", error, { pendingHash });
      setState({
        step: "error",
        device: state.device,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state.device]);

  return { state, connect, delegate, reset };
}

function logDelegation(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info("[Firefly delegation]", message, details);
    return;
  }
  console.info("[Firefly delegation]", message);
}

function logDelegationError(
  message: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[Firefly delegation]", message, {
    ...details,
    error: errorMessage,
  });
}

function startReceiptWaitLog(hash: `0x${string}`): () => void {
  const startedAt = Date.now();
  logDelegation("Waiting for transaction receipt", {
    hash,
    pollingIntervalMs: SUBMITTED_TRANSACTION_RECEIPT_POLLING_INTERVAL_MS,
    timeoutMs: SUBMITTED_TRANSACTION_RECEIPT_TIMEOUT_MS,
  });

  const interval = window.setInterval(() => {
    logDelegation("Still waiting for transaction receipt", {
      hash,
      elapsedMs: Date.now() - startedAt,
    });
  }, 10_000);

  return () => window.clearInterval(interval);
}
