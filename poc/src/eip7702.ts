import { concat, encodeRlp, getAddress, hexlify, keccak256, recoverAddress, Signature } from "ethers";
import { bigintToJsonValue, bigintToMinimalBytes, bytesToHex, ensureHex, hexToBytes, type Hex } from "./hex";

export type AuthorizationRequest = {
  chainId: bigint;
  contractAddress: string;
  nonce: bigint;
};

export type AuthorizationSignature = AuthorizationRequest & {
  yParity: number;
  r: Hex;
  s: Hex;
};

export function hashAuthorizationDigest(request: AuthorizationRequest): Hex {
  const chainId = bytesToHex(bigintToMinimalBytes(request.chainId));
  const nonce = bytesToHex(bigintToMinimalBytes(request.nonce));
  const contractAddress = getAddress(request.contractAddress);
  return keccak256(concat(["0x05", encodeRlp([chainId, contractAddress, nonce])])) as Hex;
}

export function normalizeYParity(value: number): number {
  if (value === 27 || value === 28) {
    return value - 27;
  }
  if (value === 0 || value === 1) {
    return value;
  }
  throw new Error(`Invalid recovery value: ${value}`);
}

export function recoverAuthorizationSigner(signature: AuthorizationSignature): string {
  const digest = hashAuthorizationDigest(signature);
  return getAddress(
    recoverAddress(
      digest,
      Signature.from({
        r: signature.r,
        s: signature.s,
        v: signature.yParity + 27,
      }),
    ),
  );
}

export function toFireflyAuthorizationParams(request: AuthorizationRequest) {
  return {
    chainId: bigintToMinimalBytes(request.chainId),
    contractAddress: hexToBytes(getAddress(request.contractAddress)),
    nonce: bigintToMinimalBytes(request.nonce),
  };
}

export function fromFireflyAuthorizationResult(
  request: AuthorizationRequest,
  result: unknown,
): AuthorizationSignature {
  if (!result || typeof result !== "object" || result instanceof Uint8Array || Array.isArray(result)) {
    throw new Error("Firefly returned an invalid authorization response");
  }

  const record = result as Record<string, unknown>;
  const r = record.r instanceof Uint8Array ? (hexlify(record.r) as Hex) : ensureHex(String(record.r ?? ""));
  const s = record.s instanceof Uint8Array ? (hexlify(record.s) as Hex) : ensureHex(String(record.s ?? ""));
  const recovery = Number(record.yParity ?? record.v);

  return {
    chainId: request.chainId,
    contractAddress: getAddress(request.contractAddress),
    nonce: request.nonce,
    yParity: normalizeYParity(recovery),
    r,
    s,
  };
}

export function authorizationToJson(signature: AuthorizationSignature): string {
  return JSON.stringify(
    {
      chainId: bigintToJsonValue(signature.chainId),
      contractAddress: getAddress(signature.contractAddress),
      nonce: bigintToJsonValue(signature.nonce),
      yParity: signature.yParity,
      r: signature.r,
      s: signature.s,
    },
    null,
    2,
  );
}
