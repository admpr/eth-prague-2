import { describe, expect, it } from "vitest";
import { decodeCbor, encodeCbor } from "./cbor";
import { bytesToHex } from "./hex";

describe("CBOR codec", () => {
  it("round-trips Firefly message shapes", () => {
    const message = {
      v: 1,
      method: "ffx_signAuthorization",
      id: 7,
      params: {
        chainId: new Uint8Array([0xaa, 0x36, 0xa7]),
        contractAddress: new Uint8Array(20).fill(0x12),
        nonce: new Uint8Array([0x01]),
      },
    };

    expect(decodeCbor(encodeCbor(message))).toEqual(message);
  });

  it("uses byte strings for Uint8Array values", () => {
    expect(bytesToHex(encodeCbor(new Uint8Array([0x12, 0x34])))).toBe("0x421234");
  });
});
