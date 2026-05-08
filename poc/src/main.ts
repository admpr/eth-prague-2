import { getAddress } from "ethers";
import "./style.css";
import {
  authorizationToJson,
  fromFireflyAuthorizationResult,
  recoverAuthorizationSigner,
  toFireflyAuthorizationParams,
  type AuthorizationSignature,
  type AuthorizationRequest,
} from "./eip7702";
import { FireflyClient } from "./firefly-client";
import { bytesToHex } from "./hex";
import { getChainId, getPendingNonce } from "./rpc";

const connectButton = document.querySelector<HTMLButtonElement>("#connectButton")!;
const loadContextButton = document.querySelector<HTMLButtonElement>("#loadContextButton")!;
const signButton = document.querySelector<HTMLButtonElement>("#signButton")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copyButton")!;
const broadcastButton = document.querySelector<HTMLButtonElement>("#broadcastButton")!;
const form = document.querySelector<HTMLFormElement>("#authForm")!;

const rpcUrlInput = document.querySelector<HTMLInputElement>("#rpcUrl")!;
const contractAddressInput = document.querySelector<HTMLInputElement>("#contractAddress")!;
const nonceInput = document.querySelector<HTMLInputElement>("#nonce")!;
const deviceStatus = document.querySelector<HTMLElement>("#deviceStatus")!;
const accountAddress = document.querySelector<HTMLElement>("#accountAddress")!;
const chainStatus = document.querySelector<HTMLElement>("#chainStatus")!;
const verificationStatus = document.querySelector<HTMLElement>("#verificationStatus")!;
const broadcastStatus = document.querySelector<HTMLElement>("#broadcastStatus")!;
const authorizationOutput = document.querySelector<HTMLTextAreaElement>("#authorizationOutput")!;

let firefly: FireflyClient | undefined;
let connectedAddress: string | undefined;
let chainId: bigint | undefined;
let latestAuthorization: AuthorizationSignature | undefined;

function setBusy(button: HTMLButtonElement, busy: boolean, text: string): void {
  button.disabled = busy;
  button.textContent = text;
}

function setMessage(message: string): void {
  verificationStatus.textContent = message;
}

function setBroadcastMessage(message: string): void {
  broadcastStatus.textContent = message;
}

function refreshSignState(): void {
  signButton.disabled = !(firefly && connectedAddress && rpcUrlInput.value.trim() && contractAddressInput.value.trim());
  refreshBroadcastState();
}

function refreshBroadcastState(): void {
  broadcastButton.disabled = !(latestAuthorization && connectedAddress && rpcUrlInput.value.trim());
}

function clearAuthorization(): void {
  latestAuthorization = undefined;
  authorizationOutput.value = "";
  copyButton.disabled = true;
  setBroadcastMessage("Generate an authorization before broadcasting.");
  refreshBroadcastState();
}

async function disconnect(): Promise<void> {
  await firefly?.destroy().catch(() => undefined);
  firefly = undefined;
  connectedAddress = undefined;
  deviceStatus.textContent = "Not connected";
  accountAddress.textContent = "-";
  connectButton.textContent = "Connect Firefly";
  clearAuthorization();
  refreshSignState();
}

async function loadRpcContext(): Promise<void> {
  if (!connectedAddress) {
    throw new Error("Connect Firefly first");
  }
  const rpcUrl = rpcUrlInput.value.trim();
  if (!rpcUrl) {
    throw new Error("Enter an RPC URL");
  }

  setBusy(loadContextButton, true, "Loading...");
  try {
    chainId = await getChainId(rpcUrl);
    const nonce = await getPendingNonce(rpcUrl, connectedAddress);
    chainStatus.textContent = chainId.toString();
    nonceInput.value = nonce.toString();
    setMessage("RPC context loaded.");
  } finally {
    setBusy(loadContextButton, false, "Load RPC Context");
  }
}

async function connectFirefly(): Promise<void> {
  if (firefly) {
    await disconnect();
    return;
  }

  setBusy(connectButton, true, "Connecting...");
  setMessage("Opening Web Bluetooth device picker.");
  try {
    const client = await FireflyClient.discover(true);
    firefly = client;
    firefly.ondisconnect = () => {
      void disconnect();
      setMessage("Firefly disconnected.");
    };

    deviceStatus.textContent = `${client.model}, S/N ${client.serialNumber}`;
    const result = await client.sendMessage("ffx_accounts", []);
    if (!Array.isArray(result) || !(result[0] instanceof Uint8Array)) {
      throw new Error("Firefly returned an invalid account response");
    }

    connectedAddress = getAddress(bytesToHex(result[0]));
    accountAddress.textContent = connectedAddress;
    connectButton.textContent = "Disconnect";
    setMessage("Firefly connected. Load RPC context or sign with a manual nonce.");
    refreshSignState();
  } catch (error) {
    await disconnect();
    setMessage(error instanceof Error ? error.message : String(error));
  } finally {
    connectButton.disabled = false;
  }
}

function readAuthorizationRequest(): AuthorizationRequest {
  if (!chainId) {
    const chainText = chainStatus.textContent?.trim();
    if (!chainText || chainText === "-") {
      throw new Error("Load RPC context first");
    }
    chainId = BigInt(chainText);
  }

  const nonceText = nonceInput.value.trim();
  if (!nonceText) {
    throw new Error("Load or enter the pending nonce");
  }

  return {
    chainId,
    contractAddress: getAddress(contractAddressInput.value.trim()),
    nonce: BigInt(nonceText),
  };
}

async function signAuthorization(): Promise<void> {
  if (!firefly || !connectedAddress) {
    throw new Error("Connect Firefly first");
  }

  const request = readAuthorizationRequest();
  setBusy(signButton, true, "Waiting for device...");
  setMessage("Approve the EIP-7702 authorization on Firefly.");

  try {
    const rawResult = await firefly.sendMessage("ffx_signAuthorization", toFireflyAuthorizationParams(request));
    const authorization = fromFireflyAuthorizationResult(request, rawResult);
    const recovered = recoverAuthorizationSigner(authorization);
    if (getAddress(recovered) !== getAddress(connectedAddress)) {
      throw new Error(`Signature recovered ${recovered}, expected ${connectedAddress}`);
    }

    latestAuthorization = authorization;
    authorizationOutput.value = authorizationToJson(authorization);
    copyButton.disabled = false;
    setBroadcastMessage("Ready to broadcast with the local broadcaster wallet.");
    setMessage(`Verified signer: ${recovered}`);
    refreshBroadcastState();
  } finally {
    setBusy(signButton, false, "Sign Authorization");
    refreshSignState();
  }
}

async function broadcastLatestAuthorization(): Promise<void> {
  if (!latestAuthorization || !connectedAddress) {
    throw new Error("Generate an authorization first");
  }
  const rpcUrl = rpcUrlInput.value.trim();
  if (!rpcUrl) {
    throw new Error("Enter an RPC URL");
  }

  setBusy(broadcastButton, true, "Broadcasting...");
  setBroadcastMessage("Sending EIP-7702 transaction from local broadcaster wallet...");
  try {
    const response = await fetch("/api/broadcast-authorization", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        rpcUrl,
        authorityAddress: connectedAddress,
        authorization: {
          chainId: latestAuthorization.chainId.toString(),
          contractAddress: latestAuthorization.contractAddress,
          nonce: latestAuthorization.nonce.toString(),
          yParity: latestAuthorization.yParity,
          r: latestAuthorization.r,
          s: latestAuthorization.s,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? `Broadcast failed with HTTP ${response.status}`);
    }

    const statusLine = result.receipt.status === "success" ? "confirmed" : "reverted";
    const delegationLine = result.isDelegated
      ? "Delegation verified on Firefly account."
      : `Delegation not found.\nExpected: ${result.expectedDelegationCode}\nActual: ${result.delegatedCode ?? "0x"}`;
    setBroadcastMessage(
      `Transaction ${statusLine}: ${result.hash}\nBlock: ${result.receipt.blockNumber.toString()}\n${delegationLine}`,
    );
  } finally {
    setBusy(broadcastButton, false, "Broadcast Authorization");
    refreshBroadcastState();
  }
}

connectButton.addEventListener("click", () => {
  void connectFirefly();
});

loadContextButton.addEventListener("click", () => {
  loadRpcContext().catch((error: unknown) => {
    setMessage(error instanceof Error ? error.message : String(error));
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  signAuthorization().catch((error: unknown) => {
    setMessage(error instanceof Error ? error.message : String(error));
  });
});

copyButton.addEventListener("click", () => {
  void navigator.clipboard.writeText(authorizationOutput.value);
  setMessage("Authorization JSON copied.");
});

broadcastButton.addEventListener("click", () => {
  broadcastLatestAuthorization().catch((error: unknown) => {
    setBroadcastMessage(error instanceof Error ? error.message : String(error));
  });
});

for (const input of [rpcUrlInput, contractAddressInput, nonceInput]) {
  input.addEventListener("input", () => {
    clearAuthorization();
    refreshSignState();
  });
}

refreshSignState();
