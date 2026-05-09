import assert from "node:assert/strict";
import test from "node:test";
import {
  FIREFLY_SESSION_STORAGE_KEY,
  clearRememberedFireflySession,
  readRememberedFireflySession,
  writeRememberedFireflySession,
} from "./session";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test("stores a reconnectable Firefly session marker", () => {
  const storage = memoryStorage();

  writeRememberedFireflySession(
    { address: "0x2222222222222222222222222222222222222222", serial: 42 },
    storage,
  );

  const remembered = readRememberedFireflySession(storage);
  assert.equal(remembered?.address, "0x2222222222222222222222222222222222222222");
  assert.equal(remembered?.serial, 42);
  assert.equal(typeof remembered?.rememberedAt, "number");
});

test("clears and ignores invalid Firefly session markers", () => {
  const storage = memoryStorage();
  storage.setItem(FIREFLY_SESSION_STORAGE_KEY, JSON.stringify({ address: "nope", serial: 1 }));
  assert.equal(readRememberedFireflySession(storage), undefined);

  writeRememberedFireflySession(
    { address: "0x2222222222222222222222222222222222222222", serial: 42 },
    storage,
  );
  clearRememberedFireflySession(storage);
  assert.equal(readRememberedFireflySession(storage), undefined);
});
