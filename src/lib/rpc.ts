import { createPublicClient, http, type Address, type Hash } from "viem";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_RPC_URL } from "./config";

export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC_URL),
});

export const SUBMITTED_TRANSACTION_RECEIPT_POLLING_INTERVAL_MS = 2_000;
export const SUBMITTED_TRANSACTION_RECEIPT_TIMEOUT_MS = 180_000;

export type SubmittedTransactionReceipt = Awaited<
  ReturnType<typeof baseSepoliaPublicClient.waitForTransactionReceipt>
>;

export type SubmittedTransactionReceiptClient = {
  waitForTransactionReceipt: (parameters: {
    hash: Hash;
    pollingInterval: number;
    timeout: number;
    checkReplacement: false;
  }) => Promise<SubmittedTransactionReceipt>;
};

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

export async function waitForSubmittedTransactionReceipt({
  hash,
  client = baseSepoliaPublicClient,
}: {
  hash: Hash;
  client?: SubmittedTransactionReceiptClient;
}): Promise<SubmittedTransactionReceipt> {
  return client.waitForTransactionReceipt({
    hash,
    pollingInterval: SUBMITTED_TRANSACTION_RECEIPT_POLLING_INTERVAL_MS,
    timeout: SUBMITTED_TRANSACTION_RECEIPT_TIMEOUT_MS,
    checkReplacement: false,
  });
}
