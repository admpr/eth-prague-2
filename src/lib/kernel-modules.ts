import {
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  serializeTransaction,
  zeroAddress,
  type Address,
  type Hex,
  type TransactionSerializableEIP1559,
} from "viem";
import {
  AGENT_PERMISSION_VALIDATOR_ADDRESS,
  BASE_SEPOLIA_CHAIN_ID,
  DELEGATE_CONTRACT_ADDRESS,
} from "./config";
import { codeMatchesDelegate } from "./delegation";
import { bigintToMinimalBytes, bytesToHex, ensureHex, hexToBytes } from "./firefly/hex";

export const KERNEL_MODULE_TYPE_VALIDATOR = 1;
export const KERNEL_EXECUTE_SELECTOR = "0xe9ae5c53" as const;
export const AGENT_READY_CACHE_PREFIX = "agentforce:agent-ready:v1";
export { BASE_SEPOLIA_CHAIN_ID };

export const kernelModuleAbi = [
  {
    type: "function",
    name: "installModule",
    stateMutability: "payable",
    inputs: [
      { name: "moduleTypeId", type: "uint256" },
      { name: "module", type: "address" },
      { name: "initData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isModuleInstalled",
    stateMutability: "view",
    inputs: [
      { name: "moduleTypeId", type: "uint256" },
      { name: "module", type: "address" },
      { name: "additionalContext", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const agentPermissionValidatorAbi = [
  {
    type: "function",
    name: "isInitialized",
    stateMutability: "view",
    inputs: [{ name: "smartAccount", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type AgentReadyStatus =
  | "missing-authority"
  | "missing-validator-config"
  | "invalid-validator-config"
  | "delegation-missing"
  | "validator-missing"
  | "ready";

export type AgentReadyResult = {
  status: AgentReadyStatus;
  validatorAddress?: Address;
};

export type AgentReadyCacheKeyOptions = {
  authority: string;
  delegate: string;
  validator: string;
};

type AgentReadyClient = {
  getCode(args: { address: Address }): Promise<Hex | undefined>;
  readContract(args: Record<string, unknown>): Promise<unknown>;
};

export type FireflyTransactionRequest = {
  chainId: bigint;
  nonce: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  to: Address | string;
  value: bigint;
  data: Hex;
};

export type FireflyTransactionParams = {
  type: Uint8Array;
  chainId: Uint8Array;
  nonce: Uint8Array;
  gasLimit: Uint8Array;
  maxFeePerGas: Uint8Array;
  maxPriorityFeePerGas: Uint8Array;
  to: Uint8Array;
  value: Uint8Array;
  data: Uint8Array;
  accessList: [];
};

export type FireflyTransactionSignature = {
  yParity: 0 | 1;
  r: Hex;
  s: Hex;
};

export function normalizeAgentPermissionValidatorAddress(value: string | undefined): Address | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!isAddress(trimmed)) return undefined;
  return getAddress(trimmed);
}

export function getConfiguredAgentPermissionValidatorAddress(): Address | undefined {
  return normalizeAgentPermissionValidatorAddress(AGENT_PERMISSION_VALIDATOR_ADDRESS);
}

export function hasInvalidAgentPermissionValidatorConfig(): boolean {
  const value = AGENT_PERMISSION_VALIDATOR_ADDRESS?.trim();
  if (!value) return false;
  return Boolean(value && !isAddress(value));
}

export function buildAgentPermissionValidatorInitData(): Hex {
  return concat([
    zeroAddress,
    encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }],
      ["0x", "0x", KERNEL_EXECUTE_SELECTOR],
    ),
  ]);
}

export function buildInstallAgentPermissionValidatorCalldata(validatorAddress: string): Hex {
  return encodeFunctionData({
    abi: kernelModuleAbi,
    functionName: "installModule",
    args: [
      BigInt(KERNEL_MODULE_TYPE_VALIDATOR),
      getAddress(validatorAddress),
      buildAgentPermissionValidatorInitData(),
    ],
  });
}

export function buildIsAgentPermissionValidatorInstalledArgs(validatorAddress: string) {
  return [BigInt(KERNEL_MODULE_TYPE_VALIDATOR), getAddress(validatorAddress), "0x"] as const;
}

export function buildAgentReadyCacheKey({
  authority,
  delegate,
  validator,
}: AgentReadyCacheKeyOptions): string {
  return [
    AGENT_READY_CACHE_PREFIX,
    BASE_SEPOLIA_CHAIN_ID,
    getAddress(authority).toLowerCase(),
    getAddress(delegate).toLowerCase(),
    getAddress(validator).toLowerCase(),
  ].join(":");
}

export function buildAgentReadyCookieName(options: AgentReadyCacheKeyOptions): string {
  const key = buildAgentReadyCacheKey(options);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `af_ready_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function checkAgentReadyWallet(
  client: AgentReadyClient,
  authority?: string,
): Promise<AgentReadyResult> {
  if (!authority || !isAddress(authority)) return { status: "missing-authority" };
  if (hasInvalidAgentPermissionValidatorConfig()) return { status: "invalid-validator-config" };

  const validatorAddress = getConfiguredAgentPermissionValidatorAddress();
  if (!validatorAddress) return { status: "missing-validator-config" };

  const account = getAddress(authority);
  const code = await client.getCode({ address: account });
  if (!codeMatchesDelegate(code, DELEGATE_CONTRACT_ADDRESS)) {
    return { status: "delegation-missing", validatorAddress };
  }

  const installed = await client.readContract({
    address: account,
    abi: kernelModuleAbi,
    functionName: "isModuleInstalled",
    args: buildIsAgentPermissionValidatorInstalledArgs(validatorAddress),
  });

  if (!Boolean(installed)) return { status: "validator-missing", validatorAddress };

  const initialized = await client
    .readContract({
      address: validatorAddress,
      abi: agentPermissionValidatorAbi,
      functionName: "isInitialized",
      args: [account],
    })
    .catch(() => true);

  return { status: Boolean(initialized) ? "ready" : "validator-missing", validatorAddress };
}

export function toFireflyTransactionParams(
  tx: FireflyTransactionRequest,
): FireflyTransactionParams {
  return {
    type: bigintToMinimalBytes(2n),
    chainId: bigintToMinimalBytes(tx.chainId),
    nonce: bigintToMinimalBytes(tx.nonce),
    gasLimit: bigintToMinimalBytes(tx.gasLimit),
    maxFeePerGas: bigintToMinimalBytes(tx.maxFeePerGas),
    maxPriorityFeePerGas: bigintToMinimalBytes(tx.maxPriorityFeePerGas),
    to: hexToBytes(getAddress(tx.to)),
    value: bigintToMinimalBytes(tx.value),
    data: hexToBytes(tx.data),
    accessList: [],
  };
}

export function fromFireflyTransactionSignature(result: unknown): FireflyTransactionSignature {
  if (!result || typeof result !== "object" || result instanceof Uint8Array || Array.isArray(result)) {
    throw new Error("Hardware wallet returned an invalid transaction signature");
  }

  const record = result as Record<string, unknown>;
  const r = record.r instanceof Uint8Array ? bytesToHex(record.r) : ensureHex(String(record.r ?? ""));
  const s = record.s instanceof Uint8Array ? bytesToHex(record.s) : ensureHex(String(record.s ?? ""));
  const recovery = Number(record.yParity ?? record.v);
  if (recovery !== 0 && recovery !== 1 && recovery !== 27 && recovery !== 28) {
    throw new Error(`Invalid transaction recovery value: ${recovery}`);
  }
  return {
    r,
    s,
    yParity: recovery === 27 || recovery === 28 ? ((recovery - 27) as 0 | 1) : (recovery as 0 | 1),
  };
}

export function serializeSignedFireflyTransaction(
  tx: FireflyTransactionRequest,
  signature: FireflyTransactionSignature,
): Hex {
  const serializable: TransactionSerializableEIP1559 = {
    type: "eip1559",
    chainId: Number(tx.chainId || BigInt(BASE_SEPOLIA_CHAIN_ID)),
    nonce: Number(tx.nonce),
    gas: tx.gasLimit,
    maxFeePerGas: tx.maxFeePerGas,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    to: getAddress(tx.to),
    value: tx.value,
    data: tx.data,
  };

  return serializeTransaction(serializable, signature);
}
