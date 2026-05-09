export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const BASE_SEPOLIA_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";

export const DELEGATE_CONTRACT_ADDRESS =
  "0xd6CEDDe84be40893d153Be9d467CD6aD37875b28" as const;

export const AGENT_PERMISSION_VALIDATOR_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_PERMISSION_VALIDATOR_ADDRESS;

export const BASE_SEPOLIA_EXPLORER_TX = "https://sepolia.basescan.org/tx";
export const BASE_SEPOLIA_EXPLORER_ADDRESS = "https://sepolia.basescan.org/address";

// Circle's official testnet USDC on Base Sepolia (6 decimals).
export const BASE_SEPOLIA_USDC_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const BASE_SEPOLIA_USDC_DECIMALS = 6;

// WETH9 on Base Sepolia.
export const BASE_SEPOLIA_WETH_ADDRESS =
  "0x4200000000000000000000000000000000000006" as const;
export const BASE_SEPOLIA_WETH_DECIMALS = 18;

export function isPlaceholderDelegate(): boolean {
  return /^0x0+$/i.test(DELEGATE_CONTRACT_ADDRESS);
}
