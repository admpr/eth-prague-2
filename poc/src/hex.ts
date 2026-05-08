export type Hex = `0x${string}`;

export function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToBytes(value: string): Uint8Array {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length % 2 !== 0 || /[^a-fA-F0-9]/.test(normalized)) {
    throw new Error("Invalid hex string");
  }

  const result = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}

export function bigintToMinimalBytes(value: bigint): Uint8Array {
  if (value < 0n) {
    throw new Error("Expected an unsigned integer");
  }
  if (value === 0n) {
    return new Uint8Array();
  }

  let hex = value.toString(16);
  if (hex.length % 2) {
    hex = `0${hex}`;
  }
  return hexToBytes(hex);
}

export function bytesToBigint(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

export function bigintToJsonValue(value: bigint): number | string {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}

export function ensureHex(value: string): Hex {
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}
