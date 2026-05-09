import assert from "node:assert/strict";
import test from "node:test";
import { decodeFunctionData, getAddress } from "viem";
import {
  AGENT_PERMISSION_VALIDATOR_ABI,
  BASE_SEPOLIA_TOKEN_PRESETS,
  type PermissionDraft,
  buildPermissionConfig,
  buildRemovePermissionCalldata,
  buildSetPermissionCalldata,
  limitPeriodToSeconds,
  normalizeFunctionSelector,
  parseLimitAmount,
  validatePermissionDraft,
} from "./agent-permissions";

const signer = "0x1111111111111111111111111111111111111111";
const target = "0x2222222222222222222222222222222222222222";

function baseDraft(overrides: Partial<PermissionDraft> = {}): PermissionDraft {
  return {
    signer,
    name: "Invoice assistant",
    validAfter: "",
    validUntil: "",
    nativeLimitEnabled: true,
    nativeLimitAmount: "0.05",
    nativeLimitPeriod: { kind: "daily" },
    tokenLimits: [
      {
        id: "limit-1",
        token: BASE_SEPOLIA_TOKEN_PRESETS[0].address,
        symbol: "USDC",
        decimals: 6,
        amount: "25.5",
        period: { kind: "weekly" },
      },
    ],
    contractAccess: "whitelist",
    callRules: [
      {
        id: "rule-1",
        target,
        mode: "selector",
        selector: "0xa9059cbb",
      },
    ],
    ...overrides,
  };
}

test("converts fixed/hourly/daily/weekly/custom period to seconds", () => {
  assert.equal(limitPeriodToSeconds({ kind: "fixed" }), 0);
  assert.equal(limitPeriodToSeconds({ kind: "hourly" }), 3600);
  assert.equal(limitPeriodToSeconds({ kind: "daily" }), 86400);
  assert.equal(limitPeriodToSeconds({ kind: "weekly" }), 604800);
  assert.equal(limitPeriodToSeconds({ kind: "custom", seconds: 12345 }), 12345);
});

test("rejects invalid custom reset periods", () => {
  assert.throws(() => limitPeriodToSeconds({ kind: "custom", seconds: 0 }), /reset period/i);
  assert.throws(() => limitPeriodToSeconds({ kind: "custom", seconds: 1.5 }), /reset period/i);
  assert.throws(() => limitPeriodToSeconds({ kind: "custom", seconds: Number.NaN }), /reset period/i);
});

test("parses decimal limits for 6 and 18 decimals", () => {
  assert.equal(parseLimitAmount("25.5", 6), 25_500_000n);
  assert.equal(parseLimitAmount("0.05", 18), 50_000_000_000_000_000n);
});

test("rejects empty amount", () => {
  assert.throws(() => parseLimitAmount("", 6), /amount/i);
  assert.throws(() => parseLimitAmount("   ", 18), /amount/i);
});

test("normalizes uppercase selector to lowercase", () => {
  assert.equal(normalizeFunctionSelector("0xA9059CBB"), "0xa9059cbb");
});

test("rejects malformed selector", () => {
  assert.throws(() => normalizeFunctionSelector("0xa9059cb"), /selector/i);
  assert.throws(() => normalizeFunctionSelector("transfer"), /selector/i);
});

test("requires at least one call rule when whitelist-only is selected", () => {
  const errors = validatePermissionDraft(baseDraft({ callRules: [] }));

  assert.match(errors.join("\n"), /at least one contract rule/i);
});

test("builds setPermission calldata for call-any access", () => {
  const calldata = buildSetPermissionCalldata(
    buildPermissionConfig(
      baseDraft({
        contractAccess: "any",
        callRules: [
          {
            id: "ignored-rule",
            target,
            mode: "selector",
            selector: "0xa9059cbb",
          },
        ],
      }),
    ),
  );
  const decoded = decodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    data: calldata,
  });

  assert.equal(decoded.functionName, "setPermission");
  const config = decoded.args?.[0];
  assert.equal(config?.signer, getAddress(signer));
  assert.equal(config?.requireAllowedCall, false);
  assert.deepEqual(config?.callRules, []);
});

test("builds setPermission calldata for whitelist selector and native/token limits", () => {
  const calldata = buildSetPermissionCalldata(buildPermissionConfig(baseDraft()));
  const decoded = decodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    data: calldata,
  });

  assert.equal(decoded.functionName, "setPermission");
  const config = decoded.args?.[0];
  assert.equal(config?.signer, getAddress(signer));
  assert.equal(config?.requireAllowedCall, true);
  assert.equal(config?.callRules[0]?.target, getAddress(target));
  assert.equal(config?.callRules[0]?.selector, "0xa9059cbb");
  assert.equal(config?.callRules[0]?.allowAnySelector, false);
  assert.equal(config?.nativeLimitEnabled, true);
  assert.equal(config?.nativeLimit.amount, 50_000_000_000_000_000n);
  assert.equal(config?.nativeLimit.period, 86400);
  assert.equal(config?.tokenLimits[0]?.limit.amount, 25_500_000n);
  assert.equal(config?.tokenLimits[0]?.limit.period, 604800);
});

test("builds removePermission calldata and decodes signer", () => {
  const calldata = buildRemovePermissionCalldata(signer);
  const decoded = decodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    data: calldata,
  });

  assert.equal(decoded.functionName, "removePermission");
  assert.deepEqual(decoded.args, [getAddress(signer)]);
});
