"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER_TX } from "@/lib/config";
import { FireflyClient } from "@/lib/firefly/firefly-client";
import { bytesToHex } from "@/lib/firefly/hex";
import {
  fromFireflyTransactionSignature,
  serializeSignedFireflyTransaction,
  toFireflyTransactionParams,
  type FireflyTransactionRequest,
} from "@/lib/kernel-modules";
import { baseSepoliaPublicClient, getPendingNonce } from "@/lib/rpc";
import { shortAddress } from "@/lib/utils";

export type PermissionTxStep =
  | "idle"
  | "connecting"
  | "preparing"
  | "awaitingDevice"
  | "broadcasting"
  | "confirmed"
  | "error";

export type PermissionTxState = {
  step: PermissionTxStep;
  hash?: Hex;
  error?: string;
};

export function useAgentPermissionTransactions(authority?: string) {
  const [state, setState] = useState<PermissionTxState>({ step: "idle" });
  const fireflyRef = useRef<FireflyClient | undefined>(undefined);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      void fireflyRef.current?.destroy().catch(() => undefined);
    };
  }, []);

  const setTxState = useCallback((next: PermissionTxState) => {
    if (!cancelledRef.current) {
      setState(next);
    }
  }, []);

  const reset = useCallback(() => {
    void fireflyRef.current?.destroy().catch(() => undefined);
    fireflyRef.current = undefined;
    setTxState({ step: "idle" });
  }, [setTxState]);

  const executeValidatorTransaction = useCallback(
    async ({ validator, data }: { validator: Address; data: Hex }): Promise<Hex> => {
      try {
        const account = normalizeAddress(authority);
        if (!account) {
          throw new Error("Missing authority account");
        }
        const normalizedValidator = getAddress(validator);

        setTxState({ step: "connecting" });
        await fireflyRef.current?.destroy().catch(() => undefined);
        fireflyRef.current = undefined;
        const firefly = await FireflyClient.discover(true);
        fireflyRef.current = firefly;

        const accounts = await firefly.sendMessage("ffx_accounts", []);
        if (!Array.isArray(accounts) || !(accounts[0] instanceof Uint8Array)) {
          throw new Error("Hardware wallet returned an invalid account response");
        }

        const deviceAddress = getAddress(bytesToHex(accounts[0]));
        if (deviceAddress !== account) {
          throw new Error(
            `Connected wallet ${shortAddress(deviceAddress)} does not match ${shortAddress(account)}`,
          );
        }

        setTxState({ step: "preparing" });
        const nonce = await getPendingNonce(account);
        const fees = await baseSepoliaPublicClient.estimateFeesPerGas();
        const estimatedGas = await baseSepoliaPublicClient.estimateGas({
          account,
          to: normalizedValidator,
          value: 0n,
          data,
        });

        const tx: FireflyTransactionRequest = {
          chainId: BigInt(BASE_SEPOLIA_CHAIN_ID),
          nonce,
          gasLimit: estimatedGas + estimatedGas / 5n + 10_000n,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
          to: normalizedValidator,
          value: 0n,
          data,
        };

        setTxState({ step: "awaitingDevice" });
        const rawSignature = await firefly.sendMessage(
          "ffx_signTransaction",
          toFireflyTransactionParams(tx),
        );
        const rawTransaction = serializeSignedFireflyTransaction(
          tx,
          fromFireflyTransactionSignature(rawSignature),
        );

        setTxState({ step: "broadcasting" });
        const response = await fetch("/api/broadcast-raw-transaction", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rawTransaction }),
        });
        const payload = await parseBroadcastPayload(response);
        if (!response.ok) {
          throw new Error(readBroadcastError(payload) ?? `Broadcast failed (HTTP ${response.status})`);
        }

        const hash = readBroadcastHash(payload);
        setTxState({ step: "broadcasting", hash });

        const receipt = await baseSepoliaPublicClient.waitForTransactionReceipt({
          hash,
          pollingInterval: 2000,
          retryCount: 60,
          retryDelay: 2000,
        });
        if (receipt.status !== "success") {
          throw new Error("Permission transaction reverted on chain");
        }

        setTxState({ step: "confirmed", hash });
        return hash;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setTxState({ step: "error", error: message });
        throw error;
      }
    },
    [authority, setTxState],
  );

  const explorerHref = useMemo(
    () => (state.hash ? `${BASE_SEPOLIA_EXPLORER_TX}/${state.hash}` : undefined),
    [state.hash],
  );

  return {
    state,
    reset,
    executeValidatorTransaction,
    explorerHref,
  };
}

function normalizeAddress(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value)) return undefined;
  return getAddress(value);
}

async function parseBroadcastPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function readBroadcastError(payload: unknown): string | undefined {
  if (!isRecord(payload) || typeof payload.error !== "string") {
    return undefined;
  }
  return payload.error;
}

function readBroadcastHash(payload: unknown): Hex {
  if (isRecord(payload) && typeof payload.hash === "string" && payload.hash.startsWith("0x")) {
    return payload.hash as Hex;
  }
  throw new Error("Broadcast did not return a transaction hash");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
