import { NextResponse } from "next/server";
import { submitAuthorization } from "@/lib/broadcast";
import type { AuthorizationSignature } from "@/lib/firefly/eip7702";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawAuthorization = {
  chainId?: number | string;
  contractAddress?: string;
  nonce?: number | string;
  yParity?: number;
  r?: string;
  s?: string;
};

type RequestBody = {
  authorityAddress?: string;
  authorization?: RawAuthorization;
};

function normalizeAuthorization(raw: RawAuthorization | undefined): AuthorizationSignature {
  if (!raw) {
    throw new Error("Missing authorization");
  }
  if (
    raw.chainId == null ||
    !raw.contractAddress ||
    raw.nonce == null ||
    raw.yParity == null ||
    !raw.r ||
    !raw.s
  ) {
    throw new Error("Incomplete authorization");
  }
  return {
    chainId: BigInt(raw.chainId),
    contractAddress: raw.contractAddress,
    nonce: BigInt(raw.nonce),
    yParity: raw.yParity,
    r: raw.r as `0x${string}`,
    s: raw.s as `0x${string}`,
  };
}

export async function POST(request: Request) {
  const relayerPrivateKey = process.env.FIREFLY_RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    return NextResponse.json(
      { error: "Missing FIREFLY_RELAYER_PRIVATE_KEY in .env.local" },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  if (!body.authorityAddress) {
    return NextResponse.json({ error: "Missing authorityAddress" }, { status: 400 });
  }

  try {
    const result = await submitAuthorization({
      relayerPrivateKey,
      authorization: normalizeAuthorization(body.authorization),
    });

    return NextResponse.json({
      hash: result.hash,
      relayerAddress: result.relayerAddress,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
