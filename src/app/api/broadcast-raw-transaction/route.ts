import { NextResponse } from "next/server";
import { isHex, type Hex } from "viem";
import { baseSepoliaPublicClient } from "@/lib/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  rawTransaction?: string;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  if (!body.rawTransaction || !isHex(body.rawTransaction)) {
    return NextResponse.json({ error: "Missing rawTransaction" }, { status: 400 });
  }

  try {
    const hash = await baseSepoliaPublicClient.request({
      method: "eth_sendRawTransaction",
      params: [body.rawTransaction as Hex],
    });
    return NextResponse.json({ hash });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
