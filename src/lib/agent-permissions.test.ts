import assert from "node:assert/strict";
import test from "node:test";
import { decodeFunctionData, getAddress, type Address, type Hex } from "viem";
import {
  AGENT_PERMISSION_VALIDATOR_ABI,
  BASE_SEPOLIA_TOKEN_PRESETS,
  type EmployeePermissionSnapshot,
  type PermissionDraft,
  buildPermissionConfig,
  buildRemovePermissionCalldata,
  buildSetPermissionCalldata,
  employeeSnapshotToDraft,
  formatLimitPeriodLabel,
  limitPeriodToSeconds,
  normalizeFunctionSelector,
  parseLimitAmount,
  secondsToLimitPeriod,
  validatePermissionDraft,
} from "./agent-permissions";

const signer = "0x1111111111111111111111111111111111111111";
const target = "0x2222222222222222222222222222222222222222";

function baseDraft(overrides: Partial<PermissionDraft> = {}): PermissionDraft {
  return {
    signer,
    name: "Invoice assistant",
    validityWindowEnabled: false,
    validAfter: "",
    validUntil: "",
    nativeLimitEnabled: true,
    nativeLimitAmount: "0.05",
    nativeLimitPeriod: { kind: "daily" },
    tokenLimitsEnabled: true,
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

function expectedDateTimeLocal(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

test("converts fixed/hourly/daily/weekly/custom period to seconds", () => {
  assert.equal(limitPeriodToSeconds({ kind: "fixed" }), 0);
  assert.equal(limitPeriodToSeconds({ kind: "hourly" }), 3600);
  assert.equal(limitPeriodToSeconds({ kind: "daily" }), 86400);
  assert.equal(limitPeriodToSeconds({ kind: "weekly" }), 604800);
  assert.equal(limitPeriodToSeconds({ kind: "custom", seconds: 12345 }), 12345);
});

test("converts seconds into limit period drafts", () => {
  assert.deepEqual(secondsToLimitPeriod(0), { kind: "fixed" });
  assert.deepEqual(secondsToLimitPeriod(3600), { kind: "hourly" });
  assert.deepEqual(secondsToLimitPeriod(123), { kind: "custom", seconds: 123 });
});

test("formats custom reset periods as readable durations", () => {
  assert.equal(formatLimitPeriodLabel(0), "fixed");
  assert.equal(formatLimitPeriodLabel(3600), "hour");
  assert.equal(formatLimitPeriodLabel(2592000), "30 days");
  assert.equal(formatLimitPeriodLabel(90), "90 seconds");
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

test("rejects amount precision beyond token decimals", () => {
  assert.throws(() => parseLimitAmount("1.2345675", 6), /decimals|precision/i);
  assert.throws(() => parseLimitAmount("0.0000000000000000005", 18), /decimals|precision/i);
});

test("rejects invalid token decimals", () => {
  assert.throws(() => parseLimitAmount("1", -1), /decimals/i);
  assert.throws(() => parseLimitAmount("1", 1.5), /decimals/i);
  assert.throws(() => parseLimitAmount("1", Number.NaN), /decimals/i);
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

test("converts employee permission snapshot into update draft", () => {
  const token = "0x3333333333333333333333333333333333333333" as Address;
  const validAfter = 1_700_000_040;
  const validUntil = validAfter + 3600;
  const snapshot: EmployeePermissionSnapshot = {
    signer: signer as Address,
    name: "Invoice assistant",
    validAfter,
    validUntil,
    nativeLimitEnabled: true,
    nativeLimit: { amount: 50_000_000_000_000_000n, period: 86400 },
    tokenLimits: [
      {
        token,
        symbol: "USDC",
        decimals: 6,
        limit: { amount: 25_500_000n, period: 604800 },
      },
    ],
    requireAllowedCall: true,
    callRules: [
      {
        target: target as Address,
        selector: "0xa9059cbb" as Hex,
        allowAnySelector: false,
      },
      {
        target: token,
        selector: "0x00000000" as Hex,
        allowAnySelector: true,
      },
    ],
  };

  const draft = employeeSnapshotToDraft(snapshot);

  assert.equal(draft.signer, signer);
  assert.equal(draft.name, "Invoice assistant");
  assert.equal(draft.validityWindowEnabled, true);
  assert.equal(draft.validAfter, expectedDateTimeLocal(validAfter));
  assert.equal(draft.validUntil, expectedDateTimeLocal(validUntil));
  assert.equal(draft.nativeLimitEnabled, true);
  assert.equal(draft.nativeLimitAmount, "0.05");
  assert.deepEqual(draft.nativeLimitPeriod, { kind: "daily" });
  assert.equal(draft.tokenLimitsEnabled, true);
  assert.equal(draft.tokenLimits[0]?.id, `${token}-0`);
  assert.equal(draft.tokenLimits[0]?.token, token);
  assert.equal(draft.tokenLimits[0]?.symbol, "USDC");
  assert.equal(draft.tokenLimits[0]?.decimals, 6);
  assert.equal(draft.tokenLimits[0]?.amount, "25.5");
  assert.deepEqual(draft.tokenLimits[0]?.period, { kind: "weekly" });
  assert.equal(draft.contractAccess, "whitelist");
  assert.equal(draft.callRules[0]?.id, `${target}-0`);
  assert.equal(draft.callRules[0]?.target, target);
  assert.equal(draft.callRules[0]?.mode, "selector");
  assert.equal(draft.callRules[0]?.selector, "0xa9059cbb");
  assert.equal(draft.callRules[1]?.id, `${token}-1`);
  assert.equal(draft.callRules[1]?.mode, "any");
  assert.equal(draft.callRules[1]?.selector, "");

  const config = buildPermissionConfig(draft);
  assert.equal(config.validAfter, validAfter);
  assert.equal(config.validUntil, validUntil);
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
