import assert from "node:assert/strict";
import test from "node:test";
import {
  refreshUntilEmployeeHidden,
  refreshUntilEmployeeVisible,
} from "./EmployeeManager";
import { type AgentEmployee } from "@/hooks/useAgentPermissionState";

const expectedSigner = "0x1111111111111111111111111111111111111111";
const otherSigner = "0x2222222222222222222222222222222222222222";

test("retries employee refresh until the expected signer is visible", async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await refreshUntilEmployeeVisible({
    expectedSigner,
    attempts: 3,
    delayMs: 25,
    wait: async (ms) => {
      waits.push(ms);
    },
    refresh: async () => {
      calls += 1;
      return calls < 3 ? [employee(otherSigner)] : [employee(expectedSigner)];
    },
  });

  assert.equal(calls, 3);
  assert.deepEqual(waits, [25, 25]);
  assert.equal(result?.[0]?.signer, expectedSigner);
});

test("retries employee refresh until the revoked signer is hidden", async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await refreshUntilEmployeeHidden({
    removedSigner: expectedSigner,
    attempts: 3,
    delayMs: 25,
    wait: async (ms) => {
      waits.push(ms);
    },
    refresh: async () => {
      calls += 1;
      return calls < 3 ? [employee(expectedSigner)] : [employee(otherSigner)];
    },
  });

  assert.equal(calls, 3);
  assert.deepEqual(waits, [25, 25]);
  assert.equal(result?.[0]?.signer, otherSigner);
});

function employee(signer: string): AgentEmployee {
  return {
    signer: signer as AgentEmployee["signer"],
    name: "Agent",
    avatarSeed: signer,
    active: true,
    expired: false,
    requireAllowedCall: false,
    validAfter: 0,
    validUntil: 0,
    nativeLimitEnabled: false,
    nativeLimit: {
      amount: 0n,
      period: 0,
      lastReset: 0,
      used: 0n,
    },
    callRules: [],
    tokenLimits: [],
  };
}
