"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlugZap, RefreshCw, Unplug, Wallet } from "lucide-react";
import { getAddress } from "viem";
import { Button } from "@/components/ui/button";
import { FireflyClient } from "@/lib/firefly/firefly-client";
import { bytesToHex } from "@/lib/firefly/hex";
import {
  clearRememberedFireflySession,
  readRememberedFireflySession,
  writeRememberedFireflySession,
} from "@/lib/firefly/session";
import { shortAddress } from "@/lib/utils";

type ConnectionState =
  | { step: "idle" }
  | { step: "reconnecting"; address?: string }
  | { step: "connected"; address: string; serial: number }
  | { step: "error"; address?: string }
  | { step: "disconnecting"; address?: string };

type ReconnectTrigger = "auto" | "manual";

export function shouldRequestDeviceForReconnect(trigger: ReconnectTrigger): boolean {
  return trigger === "manual";
}

export function FireflyConnectionControl() {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>({ step: "idle" });

  const reconnect = useCallback(async (trigger: ReconnectTrigger = "auto") => {
    const remembered = readRememberedFireflySession();
    if (!remembered) {
      setState({ step: "idle" });
      return;
    }

    setState({ step: "reconnecting", address: remembered.address });
    try {
      const firefly = shouldRequestDeviceForReconnect(trigger)
        ? await FireflyClient.discover(true)
        : await FireflyClient.reconnectPermitted();
      if (!firefly) {
        setState({ step: "error", address: remembered.address });
        return;
      }

      const accounts = await firefly.sendMessage("ffx_accounts", []);
      if (!Array.isArray(accounts) || !(accounts[0] instanceof Uint8Array)) {
        throw new Error("Hardware wallet returned an invalid account response");
      }

      const address = getAddress(bytesToHex(accounts[0]));
      const serial = firefly.serialNumber;
      writeRememberedFireflySession({ address, serial });
      setState({ step: "connected", address, serial });
    } catch {
      setState({ step: "error", address: remembered.address });
    }
  }, []);

  useEffect(() => {
    void reconnect();
  }, [reconnect]);

  const disconnect = useCallback(async () => {
    const address = "address" in state ? state.address : undefined;
    setState({ step: "disconnecting", address });
    clearRememberedFireflySession();
    await FireflyClient.disconnectActive().catch(() => undefined);
    setState({ step: "idle" });
    router.push("/connect");
  }, [router, state]);

  if (state.step === "idle") return null;

  if (state.step === "connected") {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 sm:inline-flex">
          <Wallet className="h-3.5 w-3.5" />
          {shortAddress(state.address, 6, 4)}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={disconnect}>
          <Unplug className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
    );
  }

  if (state.step === "error") {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void reconnect("manual")}>
          <RefreshCw className="h-3.5 w-3.5" />
          Reconnect
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={disconnect}>
          <Unplug className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled>
      {state.step === "disconnecting" ? (
        <Unplug className="h-3.5 w-3.5" />
      ) : state.step === "reconnecting" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <PlugZap className="h-3.5 w-3.5" />
      )}
      {state.step === "disconnecting" ? "Disconnecting" : "Reconnecting"}
    </Button>
  );
}
