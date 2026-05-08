import { defineConfig, loadEnv, type Plugin } from "vite";
import { broadcastAuthorization } from "./src/broadcast";
import type { AuthorizationSignature } from "./src/eip7702";

type BroadcastRequest = {
  rpcUrl?: string;
  authorityAddress?: string;
  authorization?: {
    chainId?: number | string;
    contractAddress?: string;
    nonce?: number | string;
    yParity?: number;
    r?: string;
    s?: string;
  };
};

function readJson(request: { on: (event: string, callback: (chunk: Buffer) => void) => void }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON request body"));
      }
    });
    request.on("error", reject);
  });
}

function normalizeAuthorization(authorization: BroadcastRequest["authorization"]): AuthorizationSignature {
  if (!authorization) {
    throw new Error("Missing authorization");
  }
  if (
    authorization.chainId == null ||
    !authorization.contractAddress ||
    authorization.nonce == null ||
    authorization.yParity == null ||
    !authorization.r ||
    !authorization.s
  ) {
    throw new Error("Incomplete authorization");
  }

  return {
    chainId: BigInt(authorization.chainId),
    contractAddress: authorization.contractAddress,
    nonce: BigInt(authorization.nonce),
    yParity: authorization.yParity,
    r: authorization.r as `0x${string}`,
    s: authorization.s as `0x${string}`,
  };
}

function sendJson(response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function broadcastPlugin(relayerPrivateKey: string | undefined): Plugin {
  return {
    name: "firefly-eip7702-broadcast-api",
    configureServer(server) {
      server.middlewares.use("/api/broadcast-authorization", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }
        if (!relayerPrivateKey) {
          sendJson(response, 500, { error: "Missing FIREFLY_RELAYER_PRIVATE_KEY in .env.local" });
          return;
        }

        try {
          const body = (await readJson(request)) as BroadcastRequest;
          if (!body.rpcUrl || !body.authorityAddress) {
            throw new Error("Missing RPC URL or Firefly authority address");
          }

          const result = await broadcastAuthorization({
            rpcUrl: body.rpcUrl,
            relayerPrivateKey,
            authorityAddress: body.authorityAddress,
            authorization: normalizeAuthorization(body.authorization),
          });

          sendJson(response, 200, {
            hash: result.hash,
            relayerAddress: result.relayerAddress,
            receipt: {
              blockNumber: result.receipt.blockNumber.toString(),
              status: result.receipt.status,
            },
            delegatedCode: result.delegatedCode,
            expectedDelegationCode: result.expectedDelegationCode,
            isDelegated: result.isDelegated,
          });
        } catch (error) {
          sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [broadcastPlugin(env.FIREFLY_RELAYER_PRIVATE_KEY)],
    server: {
      host: "127.0.0.1",
      port: 5173,
    },
  };
});
