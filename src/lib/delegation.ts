import { getAddress, type Hex as ViemHex } from "viem";

export function expectedDelegationCode(contractAddress: string): ViemHex {
  return `0xef0100${getAddress(contractAddress).slice(2).toLowerCase()}` as ViemHex;
}

export function codeMatchesDelegate(code: string | undefined, contractAddress: string): boolean {
  if (!code) return false;
  return code.toLowerCase() === expectedDelegationCode(contractAddress);
}
