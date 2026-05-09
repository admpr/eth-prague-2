import {
  encodeFunctionData,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import {
  BASE_SEPOLIA_USDC_ADDRESS,
  BASE_SEPOLIA_USDC_DECIMALS,
  BASE_SEPOLIA_WETH_ADDRESS,
  BASE_SEPOLIA_WETH_DECIMALS,
} from "./config";

const UINT48_MAX = 281_474_976_710_655;
const ANY_SELECTOR = "0x00000000" as const;

const limitConfigComponents = [
  { name: "amount", type: "uint256" },
  { name: "period", type: "uint48" },
] as const;

const limitComponents = [
  { name: "amount", type: "uint256" },
  { name: "period", type: "uint48" },
  { name: "lastReset", type: "uint48" },
  { name: "used", type: "uint256" },
] as const;

const callRuleComponents = [
  { name: "target", type: "address" },
  { name: "selector", type: "bytes4" },
  { name: "allowAnySelector", type: "bool" },
] as const;

const tokenLimitConfigComponents = [
  { name: "token", type: "address" },
  { name: "limit", type: "tuple", components: limitConfigComponents },
] as const;

const tokenLimitComponents = [
  { name: "token", type: "address" },
  { name: "limit", type: "tuple", components: limitComponents },
  { name: "enabled", type: "bool" },
] as const;

const permissionConfigComponents = [
  { name: "signer", type: "address" },
  { name: "requireAllowedCall", type: "bool" },
  { name: "validAfter", type: "uint48" },
  { name: "validUntil", type: "uint48" },
  { name: "callRules", type: "tuple[]", components: callRuleComponents },
  { name: "tokenLimits", type: "tuple[]", components: tokenLimitConfigComponents },
  { name: "nativeLimitEnabled", type: "bool" },
  { name: "nativeLimit", type: "tuple", components: limitConfigComponents },
] as const;

export const AGENT_PERMISSION_VALIDATOR_ABI = [
  {
    type: "function",
    name: "setPermission",
    stateMutability: "nonpayable",
    inputs: [{ name: "config", type: "tuple", components: permissionConfigComponents }],
    outputs: [],
  },
  {
    type: "function",
    name: "removePermission",
    stateMutability: "nonpayable",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getSigners",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "signers", type: "address[]" }],
  },
  {
    type: "function",
    name: "getPermissionCore",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "signer", type: "address" },
    ],
    outputs: [
      { name: "active", type: "bool" },
      { name: "requireAllowedCall", type: "bool" },
      { name: "validAfter", type: "uint48" },
      { name: "validUntil", type: "uint48" },
      { name: "nativeLimitEnabled", type: "bool" },
      { name: "nativeLimit", type: "tuple", components: limitComponents },
    ],
  },
  {
    type: "function",
    name: "getCallRules",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "signer", type: "address" },
    ],
    outputs: [{ name: "callRules", type: "tuple[]", components: callRuleComponents }],
  },
  {
    type: "function",
    name: "getTokenLimits",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "signer", type: "address" },
    ],
    outputs: [{ name: "tokenLimits", type: "tuple[]", components: tokenLimitComponents }],
  },
] as const;

export type LimitPeriod =
  | { kind: "fixed" }
  | { kind: "hourly" }
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "custom"; seconds: number | string };

export const BASE_SEPOLIA_TOKEN_PRESETS = [
  {
    symbol: "USDC",
    name: "USDC",
    address: BASE_SEPOLIA_USDC_ADDRESS,
    decimals: BASE_SEPOLIA_USDC_DECIMALS,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: BASE_SEPOLIA_WETH_ADDRESS,
    decimals: BASE_SEPOLIA_WETH_DECIMALS,
  },
  {
    symbol: "CUSTOM",
    name: "Custom ERC20",
    address: "",
    decimals: 18,
  },
] as const;

export type TokenLimitDraft = {
  id: string;
  token: string;
  symbol: string;
  decimals: number;
  amount: string;
  period: LimitPeriod;
};

export type CallRuleDraft = {
  id: string;
  target: string;
  mode: "any" | "selector";
  selector?: string;
};

export type PermissionDraft = {
  signer: string;
  name: string;
  validAfter: string | number;
  validUntil: string | number;
  nativeLimitEnabled: boolean;
  nativeLimitAmount: string;
  nativeLimitPeriod: LimitPeriod;
  tokenLimits: TokenLimitDraft[];
  contractAccess: "any" | "whitelist";
  callRules: CallRuleDraft[];
};

export type PermissionLimitConfig = {
  amount: bigint;
  period: number;
};

export type PermissionCallRuleConfig = {
  target: Address;
  selector: Hex;
  allowAnySelector: boolean;
};

export type PermissionTokenLimitConfig = {
  token: Address;
  limit: PermissionLimitConfig;
};

export type PermissionConfig = {
  signer: Address;
  requireAllowedCall: boolean;
  validAfter: number;
  validUntil: number;
  callRules: PermissionCallRuleConfig[];
  tokenLimits: PermissionTokenLimitConfig[];
  nativeLimitEnabled: boolean;
  nativeLimit: PermissionLimitConfig;
};

export function limitPeriodToSeconds(period: LimitPeriod): number {
  switch (period.kind) {
    case "fixed":
      return 0;
    case "hourly":
      return 3600;
    case "daily":
      return 86400;
    case "weekly":
      return 604800;
    case "custom":
      return parsePositiveWholeSeconds(period.seconds);
  }
}

export function parseLimitAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Limit amount is required.");
  }

  let amount: bigint;
  try {
    amount = decimals === 18 ? parseEther(trimmed) : parseUnits(trimmed, decimals);
  } catch {
    throw new Error("Limit amount must be a valid decimal value.");
  }

  if (amount <= 0n) {
    throw new Error("Limit amount must be greater than 0.");
  }

  return amount;
}

export function normalizeFunctionSelector(value: string): Hex {
  const selector = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]{8}$/.test(selector)) {
    throw new Error("Function selector must be a bytes4 hex value like 0xa9059cbb.");
  }
  return selector as Hex;
}

export function validatePermissionDraft(draft: PermissionDraft): string[] {
  const errors: string[] = [];

  if (!draft.name.trim()) {
    errors.push("Agent name is required.");
  }

  if (!isNonZeroAddress(draft.signer)) {
    errors.push("Signer address is invalid.");
  }

  const validAfter = parseOptionalUint48(draft.validAfter, "validAfter", errors);
  const validUntil = parseOptionalUint48(draft.validUntil, "validUntil", errors);
  if (validUntil !== undefined && validUntil > 0 && (validAfter ?? 0) >= validUntil) {
    errors.push("validUntil must be after validAfter.");
  }

  if (draft.nativeLimitEnabled) {
    if (!draft.nativeLimitAmount.trim()) {
      errors.push("Native ETH amount is required when native limit is enabled.");
    } else {
      collectAmountError(() => parseLimitAmount(draft.nativeLimitAmount, 18), errors);
    }
    collectLimitPeriodError(draft.nativeLimitPeriod, errors);
  }

  for (const tokenLimit of draft.tokenLimits) {
    const label = tokenLimit.symbol || tokenLimit.id || "token";
    if (!isNonZeroAddress(tokenLimit.token)) {
      errors.push(`${label} token address is invalid or zero.`);
    }
    if (!tokenLimit.amount.trim()) {
      errors.push(`${label} token amount is required.`);
    } else {
      collectAmountError(() => parseLimitAmount(tokenLimit.amount, tokenLimit.decimals), errors);
    }
    collectLimitPeriodError(tokenLimit.period, errors);
  }

  if (draft.contractAccess === "whitelist") {
    if (draft.callRules.length === 0) {
      errors.push("Whitelist-only access requires at least one contract rule.");
    }

    for (const callRule of draft.callRules) {
      if (!isNonZeroAddress(callRule.target)) {
        errors.push("Call rule target address is invalid.");
      }
      if (callRule.mode === "selector") {
        try {
          normalizeFunctionSelector(callRule.selector ?? "");
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "Function selector is invalid.");
        }
      }
    }
  }

  return errors;
}

export function buildPermissionConfig(draft: PermissionDraft): PermissionConfig {
  const errors = validatePermissionDraft(draft);
  if (errors.length > 0) {
    throw new Error(`Cannot build permission config: ${errors.join(" ")}`);
  }

  const nativeLimit = draft.nativeLimitEnabled
    ? {
        amount: parseLimitAmount(draft.nativeLimitAmount, 18),
        period: limitPeriodToSeconds(draft.nativeLimitPeriod),
      }
    : { amount: 0n, period: 0 };

  return {
    signer: getAddress(draft.signer),
    requireAllowedCall: draft.contractAccess === "whitelist",
    validAfter: parseOptionalUint48OrThrow(draft.validAfter, "validAfter"),
    validUntil: parseOptionalUint48OrThrow(draft.validUntil, "validUntil"),
    callRules:
      draft.contractAccess === "any"
        ? []
        : draft.callRules.map((callRule) => ({
            target: getAddress(callRule.target),
            selector: callRule.mode === "any" ? ANY_SELECTOR : normalizeFunctionSelector(callRule.selector ?? ""),
            allowAnySelector: callRule.mode === "any",
          })),
    tokenLimits: draft.tokenLimits.map((tokenLimit) => ({
      token: getAddress(tokenLimit.token),
      limit: {
        amount: parseLimitAmount(tokenLimit.amount, tokenLimit.decimals),
        period: limitPeriodToSeconds(tokenLimit.period),
      },
    })),
    nativeLimitEnabled: draft.nativeLimitEnabled,
    nativeLimit,
  };
}

export function buildSetPermissionCalldata(config: PermissionConfig): Hex {
  return encodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    functionName: "setPermission",
    args: [config],
  });
}

export function buildRemovePermissionCalldata(signer: string): Hex {
  return encodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    functionName: "removePermission",
    args: [getAddress(signer)],
  });
}

function parsePositiveWholeSeconds(value: number | string): number {
  const seconds =
    typeof value === "number" ? value : /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > UINT48_MAX) {
    throw new Error("Custom reset period must be a whole number of seconds greater than 0.");
  }
  return seconds;
}

function parseOptionalUint48(value: string | number, label: string, errors: string[]): number | undefined {
  try {
    return parseOptionalUint48OrThrow(value, label);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `${label} is invalid.`);
    return undefined;
  }
}

function parseOptionalUint48OrThrow(value: string | number, label: string): number {
  const text = String(value).trim();
  if (!text) return 0;
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a whole number of seconds.`);
  }

  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > UINT48_MAX) {
    throw new Error(`${label} must fit within uint48 seconds.`);
  }
  return parsed;
}

function collectAmountError(parse: () => bigint, errors: string[]): void {
  try {
    parse();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Limit amount is invalid.");
  }
}

function collectLimitPeriodError(period: LimitPeriod, errors: string[]): void {
  try {
    limitPeriodToSeconds(period);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Reset period is invalid.");
  }
}

function isNonZeroAddress(value: string): boolean {
  const trimmed = value.trim();
  return isAddress(trimmed) && getAddress(trimmed) !== zeroAddress;
}
