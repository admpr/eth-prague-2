import {
  BASE_SEPOLIA_TOKEN_PRESETS,
  formatDateTimeLocal,
  type PermissionDraft,
} from "./agent-permissions";

const SECONDS_PER_DAY = 86_400;
const MONTH_SECONDS = 30 * SECONDS_PER_DAY;
const DEMO_SWAP_ROUTER_ADDRESS = "0x1111111111111111111111111111111111111111";
const DEMO_REWARDS_CONTRACT_ADDRESS = "0x2222222222222222222222222222222222222222";
const DEMO_GOVERNANCE_CONTRACT_ADDRESS = "0x3333333333333333333333333333333333333333";
const CLAIM_SELECTOR = "0x4e71d92d";
const CAST_VOTE_SELECTOR = "0x56781388";
const SWAP_EXACT_TOKENS_FOR_TOKENS_SELECTOR = "0x38ed1739";

export const CAPABILITY_PRESETS = [
  {
    id: "stablecoin-assistant",
    title: "Stablecoin Assistant",
    role: "Pays invoices and subscriptions",
    budget: "500 USDC / month",
    expires: "Never",
  },
  {
    id: "defi-rebalancer",
    title: "DeFi Rebalancer",
    role: "Keeps your portfolio in target weights",
    budget: "0.5 ETH cap · swap-only",
    expires: "30 days",
    validityDays: 30,
  },
  {
    id: "rewards-claimer",
    title: "Rewards Claimer",
    role: "Harvests rewards as they accrue",
    budget: "Zero spend · claim selectors only",
    expires: "30 days",
    validityDays: 30,
  },
  {
    id: "treasury-payer",
    title: "Treasury Payer",
    role: "Schedules recurring vendor payouts",
    budget: "1,000 USDC / month",
    expires: "30 days",
    validityDays: 30,
  },
  {
    id: "gas-runner",
    title: "Gas Runner",
    role: "Covers transaction fees for operators",
    budget: "0.1 ETH / week",
    expires: "14 days",
    validityDays: 14,
  },
  {
    id: "governance-voter",
    title: "Governance Voter",
    role: "Casts approved protocol votes",
    budget: "Zero spend · vote selector only",
    expires: "30 days",
    validityDays: 30,
  },
] as const;

export type CapabilityPreset = (typeof CAPABILITY_PRESETS)[number];
export type CapabilityPresetId = CapabilityPreset["id"];

export function createCapabilityPresetDraft(
  presetId: CapabilityPresetId,
  now = new Date(),
): PermissionDraft {
  const preset = CAPABILITY_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) {
    throw new Error(`Unknown capability preset: ${presetId}`);
  }

  const validUntil =
    "validityDays" in preset
      ? formatDateTimeLocal(
          Math.floor(now.getTime() / 1000) + preset.validityDays * SECONDS_PER_DAY,
        )
      : undefined;

  switch (presetId) {
    case "stablecoin-assistant": {
      const usdc = BASE_SEPOLIA_TOKEN_PRESETS[0];
      return {
        ...basePresetDraft(preset.title, validUntil),
        tokenLimitsEnabled: true,
        tokenLimits: [
          {
            id: "preset-usdc-monthly",
            token: usdc.address,
            symbol: usdc.symbol,
            decimals: usdc.decimals,
            amount: "500",
            period: { kind: "custom", seconds: MONTH_SECONDS },
          },
        ],
      };
    }
    case "defi-rebalancer": {
      return {
        ...basePresetDraft(preset.title, validUntil),
        nativeLimitEnabled: true,
        nativeLimitAmount: "0.5",
        nativeLimitPeriod: { kind: "weekly" },
        contractAccess: "whitelist",
        callRules: [
          {
            id: "preset-swap-router",
            target: DEMO_SWAP_ROUTER_ADDRESS,
            mode: "selector",
            selector: SWAP_EXACT_TOKENS_FOR_TOKENS_SELECTOR,
          },
        ],
      };
    }
    case "rewards-claimer": {
      return {
        ...basePresetDraft(preset.title, validUntil),
        contractAccess: "whitelist",
        callRules: [
          {
            id: "preset-rewards-claim",
            target: DEMO_REWARDS_CONTRACT_ADDRESS,
            mode: "selector",
            selector: CLAIM_SELECTOR,
          },
        ],
      };
    }
    case "treasury-payer": {
      const usdc = BASE_SEPOLIA_TOKEN_PRESETS[0];
      return {
        ...basePresetDraft(preset.title, validUntil),
        tokenLimitsEnabled: true,
        tokenLimits: [
          {
            id: "preset-treasury-usdc-monthly",
            token: usdc.address,
            symbol: usdc.symbol,
            decimals: usdc.decimals,
            amount: "1000",
            period: { kind: "custom", seconds: MONTH_SECONDS },
          },
        ],
      };
    }
    case "gas-runner": {
      return {
        ...basePresetDraft(preset.title, validUntil),
        nativeLimitEnabled: true,
        nativeLimitAmount: "0.1",
        nativeLimitPeriod: { kind: "weekly" },
      };
    }
    case "governance-voter": {
      return {
        ...basePresetDraft(preset.title, validUntil),
        contractAccess: "whitelist",
        callRules: [
          {
            id: "preset-governance-vote",
            target: DEMO_GOVERNANCE_CONTRACT_ADDRESS,
            mode: "selector",
            selector: CAST_VOTE_SELECTOR,
          },
        ],
      };
    }
  }
}

function basePresetDraft(name: string, validUntil?: string): PermissionDraft {
  return {
    signer: "",
    name,
    validityWindowEnabled: Boolean(validUntil),
    validAfter: "",
    validUntil: validUntil ?? "",
    nativeLimitEnabled: false,
    nativeLimitAmount: "",
    nativeLimitPeriod: { kind: "daily" },
    tokenLimitsEnabled: false,
    tokenLimits: [],
    contractAccess: "any",
    callRules: [],
  };
}
