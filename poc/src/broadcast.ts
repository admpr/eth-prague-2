import { getAddress } from "ethers";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hash,
  type Hex as ViemHex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AuthorizationSignature } from "./eip7702";

export type BroadcastAuthorizationOptions = {
  rpcUrl: string;
  relayerPrivateKey: string;
  authorityAddress: string;
  authorization: AuthorizationSignature;
  onTransactionHash?: (hash: Hash, relayerAddress: Address) => void;
};

export type BroadcastAuthorizationResult = {
  hash: Hash;
  relayerAddress: Address;
  receipt: TransactionReceipt;
  delegatedCode?: ViemHex;
  expectedDelegationCode: ViemHex;
  isDelegated: boolean;
};

function toSafeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large for viem's JavaScript number transaction type`);
  }
  return Number(value);
}

function normalizePrivateKey(value: string): ViemHex {
  const privateKey = value.trim();
  const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Enter a 32-byte relayer private key");
  }
  return normalized as ViemHex;
}

function makeChain(chainId: bigint, rpcUrl: string) {
  const id = toSafeNumber(chainId, "Chain ID");
  return defineChain({
    id,
    name: `EIP-7702 chain ${id}`,
    nativeCurrency: {
      decimals: 18,
      name: "Ether",
      symbol: "ETH",
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  });
}

export function expectedDelegationCode(contractAddress: string): ViemHex {
  return `0xef0100${getAddress(contractAddress).slice(2).toLowerCase()}` as ViemHex;
}

export async function broadcastAuthorization({
  rpcUrl,
  relayerPrivateKey,
  authorityAddress,
  authorization,
  onTransactionHash,
}: BroadcastAuthorizationOptions): Promise<BroadcastAuthorizationResult> {
  const chain = makeChain(authorization.chainId, rpcUrl);
  const relayer = privateKeyToAccount(normalizePrivateKey(relayerPrivateKey));
  const transport = http(rpcUrl);
  const walletClient = createWalletClient({
    account: relayer,
    chain,
    transport,
  });
  const publicClient = createPublicClient({
    chain,
    transport,
  });

  const hash = await walletClient.sendTransaction({
    account: relayer,
    authorizationList: [
      {
        address: getAddress(authorization.contractAddress) as Address,
        chainId: toSafeNumber(authorization.chainId, "Authorization chain ID"),
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
  onTransactionHash?.(hash, relayer.address);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const delegatedCode = await publicClient.getCode({
    address: getAddress(authorityAddress) as Address,
  });
  const expected = expectedDelegationCode(authorization.contractAddress);

  return {
    hash,
    relayerAddress: relayer.address,
    receipt,
    delegatedCode,
    expectedDelegationCode: expected,
    isDelegated: delegatedCode?.toLowerCase() === expected,
  };
}
