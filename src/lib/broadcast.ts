import {
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hash,
  type Hex as ViemHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_RPC_URL } from "./config";
import type { AuthorizationSignature } from "./firefly/eip7702";

export type SubmitAuthorizationOptions = {
  relayerPrivateKey: string;
  authorization: AuthorizationSignature;
};

export type SubmitAuthorizationResult = {
  hash: Hash;
  relayerAddress: Address;
};

function toSafeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large for viem's transaction type`);
  }
  return Number(value);
}

function normalizePrivateKey(value: string): ViemHex {
  const privateKey = value.trim();
  const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Relayer private key must be 32 bytes hex");
  }
  return normalized as ViemHex;
}

export async function submitAuthorization({
  relayerPrivateKey,
  authorization,
}: SubmitAuthorizationOptions): Promise<SubmitAuthorizationResult> {
  const authorizationChainId = toSafeNumber(authorization.chainId, "Authorization chain ID");
  if (authorizationChainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Expected Base Sepolia chainId ${BASE_SEPOLIA_CHAIN_ID}, got ${authorizationChainId}`,
    );
  }

  const transport = http(BASE_SEPOLIA_RPC_URL);
  const relayer = privateKeyToAccount(normalizePrivateKey(relayerPrivateKey));
  const walletClient = createWalletClient({ account: relayer, chain: baseSepolia, transport });

  const hash = await walletClient.sendTransaction({
    account: relayer,
    authorizationList: [
      {
        address: getAddress(authorization.contractAddress) as Address,
        chainId: authorizationChainId,
        nonce: toSafeNumber(authorization.nonce, "Authorization nonce"),
        yParity: authorization.yParity,
        r: authorization.r as ViemHex,
        s: authorization.s as ViemHex,
      },
    ],
    data: "0x",
    to: relayer.address,
    value: 0n,
  });

  return { hash, relayerAddress: relayer.address };
}
