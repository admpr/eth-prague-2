"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import {
  AGENT_PERMISSION_VALIDATOR_ABI,
  BASE_SEPOLIA_TOKEN_PRESETS,
} from "@/lib/agent-permissions";
import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/config";
import {
  buildEmployeeMetadataStorageKey,
  indexEmployeeMetadata,
  readEmployeeMetadata,
} from "@/lib/employee-metadata";
import { getConfiguredAgentPermissionValidatorAddress } from "@/lib/kernel-modules";
import { baseSepoliaPublicClient } from "@/lib/rpc";

export type OnchainLimit = {
  amount: bigint;
  period: number;
  lastReset: number;
  used: bigint;
};

export type EmployeeCallRule = {
  target: Address;
  selector: `0x${string}`;
  allowAnySelector: boolean;
};

export type EmployeeTokenLimit = {
  token: Address;
  symbol: string;
  decimals: number;
  limit: OnchainLimit;
  enabled: boolean;
};

export type AgentEmployee = {
  signer: Address;
  name: string;
  avatarSeed: string;
  active: boolean;
  expired: boolean;
  requireAllowedCall: boolean;
  validAfter: number;
  validUntil: number;
  nativeLimitEnabled: boolean;
  nativeLimit: OnchainLimit;
  callRules: EmployeeCallRule[];
  tokenLimits: EmployeeTokenLimit[];
};

type PermissionState = {
  employees: AgentEmployee[];
  loading: boolean;
  error?: string;
};

type Uint48Value = number | bigint;

type RawOnchainLimit = {
  amount: bigint;
  period: Uint48Value;
  lastReset: Uint48Value;
  used: bigint;
};

export type AgentPermissionStateRequestGate = {
  nextRequestId: () => number;
  markMounted: () => void;
  markUnmounted: () => void;
  canUpdate: (requestId: number) => boolean;
};

export function createAgentPermissionStateRequestGate(): AgentPermissionStateRequestGate {
  let mounted = true;
  let currentRequestId = 0;

  return {
    nextRequestId() {
      currentRequestId += 1;
      return currentRequestId;
    },
    markMounted() {
      mounted = true;
    },
    markUnmounted() {
      mounted = false;
      currentRequestId += 1;
    },
    canUpdate(requestId) {
      return mounted && currentRequestId === requestId;
    },
  };
}

export function formatLimitAmount(amount: bigint, decimals: number): string {
  const formatted = decimals === 18 ? formatEther(amount) : formatUnits(amount, decimals);
  const [integer, fraction] = formatted.split(".");
  if (fraction === undefined) return integer;

  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${integer}.${trimmedFraction}` : integer;
}

export function useAgentPermissionState(authority?: string) {
  const account = useMemo(() => normalizeAddress(authority), [authority]);
  const validatorAddress = useMemo(() => getConfiguredAgentPermissionValidatorAddress(), []);
  const [state, setState] = useState<PermissionState>({
    employees: [],
    loading: Boolean(account && validatorAddress),
  });
  const requestGateRef = useRef<AgentPermissionStateRequestGate | undefined>(undefined);
  if (!requestGateRef.current) {
    requestGateRef.current = createAgentPermissionStateRequestGate();
  }
  const requestGate = requestGateRef.current;

  useEffect(() => {
    requestGate.markMounted();
    return () => {
      requestGate.markUnmounted();
    };
  }, [requestGate]);

  const refresh = useCallback(async (): Promise<AgentEmployee[]> => {
    const requestId = requestGate.nextRequestId();

    if (!account || !validatorAddress) {
      if (requestGate.canUpdate(requestId)) {
        setState({ employees: [], loading: false });
      }
      return [];
    }

    setState((current) => ({ ...current, loading: true, error: undefined }));

    try {
      const employees = await readEmployees(account, validatorAddress);
      if (requestGate.canUpdate(requestId)) {
        setState({ employees, loading: false });
      }
      return employees;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (requestGate.canUpdate(requestId)) {
        setState({ employees: [], loading: false, error: message });
      }
      return [];
    }
  }, [account, requestGate, validatorAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    employees: state.employees,
    loading: state.loading,
    error: state.error,
    account,
    validatorAddress,
    refresh,
  };
}

async function readEmployees(account: Address, validator: Address): Promise<AgentEmployee[]> {
  const metadataIndex = readMetadataIndex(account, validator);
  const signers = await baseSepoliaPublicClient.readContract({
    address: validator,
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    functionName: "getSigners",
    args: [account],
  });

  const now = Math.floor(Date.now() / 1000);
  return Promise.all(
    signers.map(async (signer) => {
      const normalizedSigner = getAddress(signer);
      const [core, callRules, tokenLimits] = await Promise.all([
        baseSepoliaPublicClient.readContract({
          address: validator,
          abi: AGENT_PERMISSION_VALIDATOR_ABI,
          functionName: "getPermissionCore",
          args: [account, normalizedSigner],
        }),
        baseSepoliaPublicClient.readContract({
          address: validator,
          abi: AGENT_PERMISSION_VALIDATOR_ABI,
          functionName: "getCallRules",
          args: [account, normalizedSigner],
        }),
        baseSepoliaPublicClient.readContract({
          address: validator,
          abi: AGENT_PERMISSION_VALIDATOR_ABI,
          functionName: "getTokenLimits",
          args: [account, normalizedSigner],
        }),
      ]);

      const [
        active,
        requireAllowedCall,
        validAfter,
        validUntil,
        nativeLimitEnabled,
        nativeLimit,
      ] = core;
      const validAfterSeconds = uint48ToNumber(validAfter);
      const validUntilSeconds = uint48ToNumber(validUntil);
      const metadata = metadataIndex.get(normalizedSigner.toLowerCase());
      const normalizedTokenLimits = await Promise.all(
        tokenLimits.map(async (tokenLimit) => {
          const token = getAddress(tokenLimit.token);
          const tokenMetadata = await getTokenMetadata(token);
          return {
            token,
            symbol: tokenMetadata.symbol,
            decimals: tokenMetadata.decimals,
            limit: normalizeLimit(tokenLimit.limit),
            enabled: tokenLimit.enabled,
          };
        }),
      );

      return {
        signer: normalizedSigner,
        name: metadata?.name || `Agent ${normalizedSigner.slice(0, 6)}`,
        avatarSeed: metadata?.avatarSeed || normalizedSigner,
        active,
        expired: validUntilSeconds !== 0 && now > validUntilSeconds,
        requireAllowedCall,
        validAfter: validAfterSeconds,
        validUntil: validUntilSeconds,
        nativeLimitEnabled,
        nativeLimit: normalizeLimit(nativeLimit),
        callRules: callRules.map((rule) => ({
          target: getAddress(rule.target),
          selector: rule.selector as Hex,
          allowAnySelector: rule.allowAnySelector,
        })),
        tokenLimits: normalizedTokenLimits,
      };
    }),
  );
}

function readMetadataIndex(account: Address, validator: Address) {
  if (typeof window === "undefined") {
    return indexEmployeeMetadata([]);
  }

  try {
    const key = buildEmployeeMetadataStorageKey({
      chainId: BASE_SEPOLIA_CHAIN_ID,
      account,
      validator,
    });
    return indexEmployeeMetadata(readEmployeeMetadata(window.localStorage, key));
  } catch {
    return new Map();
  }
}

function normalizeLimit(limit: RawOnchainLimit): OnchainLimit {
  return {
    amount: limit.amount,
    period: uint48ToNumber(limit.period),
    lastReset: uint48ToNumber(limit.lastReset),
    used: limit.used,
  };
}

async function getTokenMetadata(token: Address): Promise<{ symbol: string; decimals: number }> {
  const preset = BASE_SEPOLIA_TOKEN_PRESETS.find(
    (item) => isAddress(item.address) && getAddress(item.address) === token,
  );
  if (preset) {
    return {
      symbol: preset.symbol,
      decimals: preset.decimals,
    };
  }

  const [symbol, decimals] = await Promise.all([
    baseSepoliaPublicClient
      .readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
      })
      .catch(() => "ERC20"),
    baseSepoliaPublicClient
      .readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      })
      .catch(() => 18),
  ]);

  return {
    symbol: normalizeTokenSymbol(symbol),
    decimals: normalizeTokenDecimals(decimals),
  };
}

function normalizeTokenSymbol(value: unknown): string {
  if (typeof value !== "string") return "ERC20";
  const symbol = value.trim();
  return symbol ? symbol : "ERC20";
}

function normalizeTokenDecimals(value: unknown): number {
  const decimals = typeof value === "bigint" ? Number(value) : value;
  if (typeof decimals !== "number" || !Number.isInteger(decimals)) return 18;
  return decimals >= 0 && decimals <= 18 ? decimals : 18;
}

function normalizeAddress(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value)) return undefined;
  return getAddress(value);
}

function uint48ToNumber(value: Uint48Value): number {
  return typeof value === "bigint" ? Number(value) : value;
}
