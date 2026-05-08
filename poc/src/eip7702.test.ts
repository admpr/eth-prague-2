import * as ethers from "ethers";
import { describe, expect, it } from "vitest";
import { hashAuthorizationDigest, recoverAuthorizationSigner, type AuthorizationSignature } from "./eip7702";

describe("EIP-7702 authorization helpers", () => {
  it("matches ethers hashAuthorization", () => {
    const request = {
      chainId: 11155111n,
      contractAddress: "0x1234567890123456789012345678901234567890",
      nonce: 3n,
    };

    const hashAuthorization = (ethers as unknown as {
      hashAuthorization?: (auth: unknown) => string;
    }).hashAuthorization;

    expect(hashAuthorization).toBeTypeOf("function");
    expect(hashAuthorization?.({
      chainId: request.chainId,
      address: request.contractAddress,
      nonce: request.nonce,
    })).toBe(hashAuthorizationDigest(request));
  });

  it("recovers the expected signer", async () => {
    const wallet = ethers.Wallet.createRandom();
    const request = {
      chainId: 1n,
      contractAddress: "0x1234567890123456789012345678901234567890",
      nonce: 1n,
    };
    const digest = hashAuthorizationDigest(request);
    const rawSignature = wallet.signingKey.sign(digest);
    const authorization: AuthorizationSignature = {
      ...request,
      yParity: rawSignature.yParity,
      r: rawSignature.r as `0x${string}`,
      s: rawSignature.s as `0x${string}`,
    };

    expect(recoverAuthorizationSigner(authorization)).toBe(wallet.address);
  });
});
