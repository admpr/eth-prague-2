import assert from "node:assert/strict";
import test from "node:test";
import { getAddress, type Hex } from "viem";
import {
  buildEmployeeMetadataStorageKey,
  indexEmployeeMetadata,
  mergeEmployeeMetadata,
  parseEmployeeMetadata,
  serializeEmployeeMetadata,
  upsertEmployeeMetadata,
  type EmployeeMetadata,
  type StorageLike,
} from "./employee-metadata";

const account = "0x1111111111111111111111111111111111111111";
const validator = "0x2222222222222222222222222222222222222222";
const signer = "0x3333333333333333333333333333333333333333";

test("builds metadata key scoped to chain, account, and validator", () => {
  assert.equal(
    buildEmployeeMetadataStorageKey({ chainId: 84532, account, validator }),
    "agentforce:employee-metadata:v1:84532:0x1111111111111111111111111111111111111111:0x2222222222222222222222222222222222222222",
  );
});

test("serializes metadata as a stable JSON array", () => {
  assert.equal(
    serializeEmployeeMetadata([
      {
        signer,
        name: "Employee One",
        avatarSeed: signer,
        createdAt: "2026-05-09T10:00:00.000Z",
        updatedAt: "2026-05-09T11:00:00.000Z",
        createTxHash: "0xabc",
      },
    ]),
    '[{"signer":"0x3333333333333333333333333333333333333333","name":"Employee One","avatarSeed":"0x3333333333333333333333333333333333333333","createdAt":"2026-05-09T10:00:00.000Z","updatedAt":"2026-05-09T11:00:00.000Z","createTxHash":"0xabc"}]',
  );
});

test("indexes metadata by lowercase signer", () => {
  const index = indexEmployeeMetadata([
    {
      signer: getAddress(signer),
      name: "Employee One",
      avatarSeed: signer,
      createdAt: "2026-05-09T10:00:00.000Z",
      updatedAt: "2026-05-09T10:00:00.000Z",
    },
  ]);

  assert.deepEqual(Array.from(index.keys()), [signer]);
});

test("merges metadata by signer and preserves createdAt", () => {
  const merged = mergeEmployeeMetadata(
    [
      {
        signer,
        name: "Old name",
        avatarSeed: signer,
        createdAt: "2026-05-09T10:00:00.000Z",
        updatedAt: "2026-05-09T10:00:00.000Z",
      },
    ],
    {
      signer,
      name: "New name",
      avatarSeed: signer,
      createdAt: "2026-05-09T11:00:00.000Z",
      updatedAt: "2026-05-09T11:00:00.000Z",
      updateTxHash: "0xdef",
    },
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "New name");
  assert.equal(merged[0].createdAt, "2026-05-09T10:00:00.000Z");
  assert.equal(merged[0].updateTxHash, "0xdef");
});

test("parses missing, invalid, non-array, and malformed metadata as empty", () => {
  assert.deepEqual(parseEmployeeMetadata(null), []);
  assert.deepEqual(parseEmployeeMetadata("not-json"), []);
  assert.deepEqual(parseEmployeeMetadata("{}"), []);
  assert.deepEqual(parseEmployeeMetadata('[{"signer":"not-an-address"}]'), []);
});

test("upserts metadata through StorageLike", () => {
  const key = buildEmployeeMetadataStorageKey({ chainId: 84532, account, validator });
  const writes: Array<{ key: string; value: string }> = [];
  const existing: EmployeeMetadata = {
    signer,
    name: "Old name",
    avatarSeed: signer,
    createdAt: "2026-05-09T10:00:00.000Z",
    updatedAt: "2026-05-09T10:00:00.000Z",
  };
  const storage: StorageLike = {
    getItem: (storageKey) => (storageKey === key ? serializeEmployeeMetadata([existing]) : null),
    setItem: (storageKey, value) => {
      writes.push({ key: storageKey, value });
    },
  };

  const merged = upsertEmployeeMetadata(storage, key, {
    signer,
    name: "New name",
    avatarSeed: "new-seed",
    createdAt: "2026-05-09T11:00:00.000Z",
    updatedAt: "2026-05-09T11:00:00.000Z",
    updateTxHash: "0xdef" as Hex,
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "New name");
  assert.equal(merged[0].avatarSeed, "new-seed");
  assert.equal(merged[0].createdAt, "2026-05-09T10:00:00.000Z");
  assert.deepEqual(writes, [
    {
      key,
      value:
        '[{"signer":"0x3333333333333333333333333333333333333333","name":"New name","avatarSeed":"new-seed","createdAt":"2026-05-09T10:00:00.000Z","updatedAt":"2026-05-09T11:00:00.000Z","updateTxHash":"0xdef"}]',
    },
  ]);
});
