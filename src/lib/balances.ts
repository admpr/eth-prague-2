import { erc20Abi, formatEther, formatUnits, type Address } from "viem";
import { baseSepoliaPublicClient } from "./rpc";
import { BASE_SEPOLIA_USDC_ADDRESS, BASE_SEPOLIA_USDC_DECIMALS } from "./config";

export type AccountBalances = {
  ethWei: bigint;
  usdc: bigint;
};

export async function getAccountBalances(address: Address): Promise<AccountBalances> {
  const [ethWei, usdc] = await Promise.all([
    baseSepoliaPublicClient.getBalance({ address }),
    baseSepoliaPublicClient
      .readContract({
        address: BASE_SEPOLIA_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })
      .catch(() => 0n),
  ]);
  return { ethWei, usdc };
}

export function formatEth(wei: bigint, fractionDigits = 4): string {
  const value = Number(formatEther(wei));
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatUsdc(amount: bigint, fractionDigits = 2): string {
  const value = Number(formatUnits(amount, BASE_SEPOLIA_USDC_DECIMALS));
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}
