import { getAddress, isAddress } from "viem";

export const FIREFLY_SESSION_STORAGE_KEY = "agentforce:firefly-session:v1";

export type RememberedFireflySession = {
  address: string;
  serial: number;
  rememberedAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function readRememberedFireflySession(
  storage: StorageLike | undefined = browserStorage(),
): RememberedFireflySession | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(FIREFLY_SESSION_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<RememberedFireflySession>;
    if (!parsed.address || !isAddress(parsed.address) || typeof parsed.serial !== "number") {
      return undefined;
    }
    return {
      address: getAddress(parsed.address),
      serial: parsed.serial,
      rememberedAt: typeof parsed.rememberedAt === "number" ? parsed.rememberedAt : 0,
    };
  } catch {
    return undefined;
  }
}

export function writeRememberedFireflySession(
  session: Omit<RememberedFireflySession, "rememberedAt">,
  storage: StorageLike | undefined = browserStorage(),
): void {
  if (!storage || !isAddress(session.address)) return;
  storage.setItem(
    FIREFLY_SESSION_STORAGE_KEY,
    JSON.stringify({
      address: getAddress(session.address),
      serial: session.serial,
      rememberedAt: Date.now(),
    }),
  );
}

export function clearRememberedFireflySession(
  storage: StorageLike | undefined = browserStorage(),
): void {
  storage?.removeItem(FIREFLY_SESSION_STORAGE_KEY);
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
