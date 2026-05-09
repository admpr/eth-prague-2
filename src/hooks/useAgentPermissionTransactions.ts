"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress, isAddress, keccak256, type Address, type Hex } from "viem";
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER_TX } from "@/lib/config";
import { FireflyClient } from "@/lib/firefly/firefly-client";
import { bytesToHex } from "@/lib/firefly/hex";
import {
  fromFireflyTransactionSignature,
  serializeSignedFireflyTransaction,
  toFireflyTransactionParams,
  type FireflyTransactionRequest,
} from "@/lib/kernel-modules";
import {
  baseSepoliaPublicClient,
  getPendingNonce,
  waitForSubmittedTransactionReceipt,
} from "@/lib/rpc";
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

export type PermissionTransactionError = Error & {
  hash?: Hex;
};

export function useAgentPermissionTransactions(authority?: string) {
  const [state, setState] = useState<PermissionTxState>({ step: "idle" });
  const fireflyRef = useRef<FireflyClient | undefined>(undefined);
  const cancelledRef = useRef(false);
  const operationIdRef = useRef(0);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      operationIdRef.current += 1;
      void fireflyRef.current?.destroy().catch(() => undefined);
    };
  }, []);

  const setTxState = useCallback((operationId: number, next: PermissionTxState) => {
    if (!cancelledRef.current && operationIdRef.current === operationId) {
      setState(next);
    }
  }, []);

  const reset = useCallback(() => {
    operationIdRef.current += 1;
    void fireflyRef.current?.destroy().catch(() => undefined);
    fireflyRef.current = undefined;
    if (!cancelledRef.current) {
      setState({ step: "idle" });
    }
  }, []);

  const executeValidatorTransaction = useCallback(
    async ({ validator, data }: { validator: Address; data: Hex }): Promise<Hex> => {
      const operationId = operationIdRef.current + 1;
      operationIdRef.current = operationId;
      let knownHash: Hex | undefined;
      const isCurrentOperation = () => !cancelledRef.current && operationIdRef.current === operationId;
      const ensureCurrentOperation = () => {
        if (!isCurrentOperation()) {
          throw new Error("Permission transaction was superseded");
        }
      };

      try {
        const account = normalizeAddress(authority);
        if (!account) {
          throw new Error("Missing authority account");
        }
        const normalizedValidator = getAddress(validator);

        setTxState(operationId, { step: "connecting" });
        await fireflyRef.current?.destroy().catch(() => undefined);
        ensureCurrentOperation();
        fireflyRef.current = undefined;
        const firefly = await FireflyClient.discover(true);
        if (!isCurrentOperation()) {
          await firefly.destroy().catch(() => undefined);
          ensureCurrentOperation();
        }
        fireflyRef.current = firefly;

        const accounts = await firefly.sendMessage("ffx_accounts", []);
        ensureCurrentOperation();
        if (!Array.isArray(accounts) || !(accounts[0] instanceof Uint8Array)) {
          throw new Error("Hardware wallet returned an invalid account response");
        }

        const deviceAddress = getAddress(bytesToHex(accounts[0]));
        if (deviceAddress !== account) {
          throw new Error(
            `Connected wallet ${shortAddress(deviceAddress)} does not match ${shortAddress(account)}`,
          );
        }

        setTxState(operationId, { step: "preparing" });
        const nonce = await getPendingNonce(account);
        ensureCurrentOperation();
        const fees = await baseSepoliaPublicClient.estimateFeesPerGas();
        ensureCurrentOperation();
        const estimatedGas = await baseSepoliaPublicClient.estimateGas({
          account,
          to: normalizedValidator,
          value: 0n,
          data,
        });
        ensureCurrentOperation();

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

        setTxState(operationId, { step: "awaitingDevice" });
        const rawSignature = await firefly.sendMessage(
          "ffx_signTransaction",
          toFireflyTransactionParams(tx),
        );
        ensureCurrentOperation();
        const rawTransaction = serializeSignedFireflyTransaction(
          tx,
          fromFireflyTransactionSignature(rawSignature),
        );

        knownHash = keccak256(rawTransaction);
        setTxState(operationId, { step: "broadcasting", hash: knownHash });
        const response = await fetch("/api/broadcast-raw-transaction", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rawTransaction }),
        });
        ensureCurrentOperation();
        const payload = await parseBroadcastPayload(response);
        ensureCurrentOperation();
        if (!response.ok) {
          throw new Error(readBroadcastError(payload) ?? `Broadcast failed (HTTP ${response.status})`);
        }

        const broadcastHash = readBroadcastHash(payload);
        if (broadcastHash && broadcastHash.toLowerCase() !== knownHash.toLowerCase()) {
          throw new Error("Broadcast returned an unexpected transaction hash");
        }

        const receipt = await waitForSubmittedTransactionReceipt({ hash: knownHash });
        ensureCurrentOperation();
        if (receipt.status !== "success") {
          throw new Error("Permission transaction reverted on chain");
        }

        setTxState(operationId, { step: "confirmed", hash: knownHash });
        return knownHash;
      } catch (error) {
        const transactionError = withTransactionHash(error, knownHash);
        setTxState(operationId, { step: "error", hash: knownHash, error: transactionError.message });
        throw transactionError;
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

function readBroadcastHash(payload: unknown): Hex | undefined {
  if (isRecord(payload) && typeof payload.hash === "string" && payload.hash.startsWith("0x")) {
    return payload.hash as Hex;
  }
  return undefined;
}

function withTransactionHash(error: unknown, hash: Hex | undefined): PermissionTransactionError {
  const transactionError =
    error instanceof Error
      ? (error as PermissionTransactionError)
      : (new Error(String(error)) as PermissionTransactionError);
  if (hash) {
    transactionError.hash = hash;
  }
  return transactionError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
