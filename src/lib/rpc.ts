import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_RPC_URL } from "./config";

export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC_URL),
});

export async function getChainId(): Promise<bigint> {
  return BigInt(await baseSepoliaPublicClient.getChainId());
}

export async function getPendingNonce(address: Address): Promise<bigint> {
  const nonce = await baseSepoliaPublicClient.getTransactionCount({
    address,
    blockTag: "pending",
  });
  return BigInt(nonce);
}
