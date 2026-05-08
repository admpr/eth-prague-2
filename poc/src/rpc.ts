type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

let nextRpcId = 1;

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextRpcId++,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }

  const body = (await response.json()) as JsonRpcResponse<T>;
  if (body.error) {
    throw new Error(body.error.message);
  }
  if (body.result == null) {
    throw new Error(`RPC ${method} returned no result`);
  }
  return body.result;
}

export async function getChainId(url: string): Promise<bigint> {
  return BigInt(await rpc<string>(url, "eth_chainId", []));
}

export async function getPendingNonce(url: string, address: string): Promise<bigint> {
  return BigInt(await rpc<string>(url, "eth_getTransactionCount", [address, "pending"]));
}
