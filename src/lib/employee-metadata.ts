import { getAddress, type Address, type Hex } from "viem";

export const EMPLOYEE_METADATA_STORAGE_PREFIX = "agentforce:employee-metadata:v1";
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export type EmployeeMetadata = {
  signer: Address;
  name: string;
  avatarSeed: string;
  createdAt: string;
  updatedAt: string;
  createTxHash?: Hex;
  updateTxHash?: Hex;
  revokeTxHash?: Hex;
};

export type EmployeeMetadataKeyOptions = {
  chainId: number;
  account: string;
  validator: string;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function buildEmployeeMetadataStorageKey({
  chainId,
  account,
  validator,
}: EmployeeMetadataKeyOptions): string {
  return [
    EMPLOYEE_METADATA_STORAGE_PREFIX,
    chainId,
    getAddress(account).toLowerCase(),
    getAddress(validator).toLowerCase(),
  ].join(":");
}

export function serializeEmployeeMetadata(metadata: EmployeeMetadata[]): string {
  return JSON.stringify(metadata.map(normalizeEmployeeMetadata));
}

export function parseEmployeeMetadata(value: string | null): EmployeeMetadata[] {
  if (value === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const metadata: EmployeeMetadata[] = [];
  for (const item of parsed) {
    const normalized = parseEmployeeMetadataItem(item);
    if (!normalized) return [];
    metadata.push(normalized);
  }

  return metadata;
}

export function indexEmployeeMetadata(metadata: EmployeeMetadata[]): Map<string, EmployeeMetadata> {
  const index = new Map<string, EmployeeMetadata>();
  for (const item of metadata) {
    const normalized = normalizeEmployeeMetadata(item);
    index.set(normalized.signer.toLowerCase(), normalized);
  }
  return index;
}

export function mergeEmployeeMetadata(
  current: EmployeeMetadata[],
  next: EmployeeMetadata,
): EmployeeMetadata[] {
  const index = indexEmployeeMetadata(current);
  const normalizedNext = normalizeEmployeeMetadata(next);
  const key = normalizedNext.signer.toLowerCase();
  const existing = index.get(key);
  const merged: EmployeeMetadata = {
    ...normalizedNext,
    createdAt: existing?.createdAt ?? normalizedNext.createdAt,
  };

  preserveExistingTxHash(merged, existing, "createTxHash");
  preserveExistingTxHash(merged, existing, "updateTxHash");
  preserveExistingTxHash(merged, existing, "revokeTxHash");

  index.set(key, merged);

  return Array.from(index.values());
}

export function readEmployeeMetadata(storage: StorageLike, key: string): EmployeeMetadata[] {
  return parseEmployeeMetadata(storage.getItem(key));
}

export function writeEmployeeMetadata(
  storage: StorageLike,
  key: string,
  metadata: EmployeeMetadata[],
): void {
  storage.setItem(key, serializeEmployeeMetadata(metadata));
}

export function upsertEmployeeMetadata(
  storage: StorageLike,
  key: string,
  metadata: EmployeeMetadata,
): EmployeeMetadata[] {
  const merged = mergeEmployeeMetadata(readEmployeeMetadata(storage, key), metadata);
  writeEmployeeMetadata(storage, key, merged);
  return merged;
}

function normalizeEmployeeMetadata(metadata: EmployeeMetadata): EmployeeMetadata {
  const normalized: EmployeeMetadata = {
    signer: getAddress(metadata.signer),
    name: metadata.name,
    avatarSeed: metadata.avatarSeed,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };

  if (metadata.createTxHash !== undefined) {
    normalized.createTxHash = normalizeTransactionHash(metadata.createTxHash);
  }
  if (metadata.updateTxHash !== undefined) {
    normalized.updateTxHash = normalizeTransactionHash(metadata.updateTxHash);
  }
  if (metadata.revokeTxHash !== undefined) {
    normalized.revokeTxHash = normalizeTransactionHash(metadata.revokeTxHash);
  }

  return normalized;
}

function parseEmployeeMetadataItem(item: unknown): EmployeeMetadata | undefined {
  if (!isRecord(item)) return undefined;
  if (
    typeof item.signer !== "string" ||
    typeof item.name !== "string" ||
    typeof item.avatarSeed !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string" ||
    !isOptionalTransactionHash(item.createTxHash) ||
    !isOptionalTransactionHash(item.updateTxHash) ||
    !isOptionalTransactionHash(item.revokeTxHash)
  ) {
    return undefined;
  }

  try {
    return normalizeEmployeeMetadata({
      signer: item.signer as Address,
      name: item.name,
      avatarSeed: item.avatarSeed,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createTxHash: item.createTxHash,
      updateTxHash: item.updateTxHash,
      revokeTxHash: item.revokeTxHash,
    });
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function preserveExistingTxHash(
  metadata: EmployeeMetadata,
  existing: EmployeeMetadata | undefined,
  field: "createTxHash" | "updateTxHash" | "revokeTxHash",
): void {
  if (metadata[field] === undefined && existing?.[field] !== undefined) {
    metadata[field] = existing[field];
  }
}

function normalizeTransactionHash(value: Hex): Hex {
  if (!TRANSACTION_HASH_PATTERN.test(value)) {
    throw new Error("Expected 32-byte transaction hash");
  }
  return value;
}

function isOptionalTransactionHash(value: unknown): value is Hex | undefined {
  return value === undefined || (typeof value === "string" && TRANSACTION_HASH_PATTERN.test(value));
}
