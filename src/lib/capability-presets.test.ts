import assert from "node:assert/strict";
import test from "node:test";
import { type Address } from "viem";
import { buildPermissionConfig } from "./agent-permissions";
import {
  CAPABILITY_PRESETS,
  createCapabilityPresetDraft,
} from "./capability-presets";

const signer = "0x3333333333333333333333333333333333333333" as Address;
const now = new Date("2026-05-09T10:00:00.000Z");

for (const preset of CAPABILITY_PRESETS) {
  test(`${preset.title} creates a confirm-ready permission draft`, () => {
    const draft = createCapabilityPresetDraft(preset.id, now);
    const config = buildPermissionConfig({ ...draft, signer });

    assert.equal(draft.signer, "");
    assert.equal(draft.name, preset.title);
    assert.equal(config.signer, signer);
    assert.equal(
      config.validUntil,
      "validityDays" in preset
        ? Math.floor(now.getTime() / 1000) + preset.validityDays * 86_400
        : 0,
    );
  });
}

test("stablecoin assistant never expires", () => {
  const draft = createCapabilityPresetDraft("stablecoin-assistant", now);
  const config = buildPermissionConfig({ ...draft, signer });

  assert.equal(draft.validityWindowEnabled, false);
  assert.equal(draft.validUntil, "");
  assert.equal(config.validUntil, 0);
});

test("defi rebalancer expires after 30 days", () => {
  const draft = createCapabilityPresetDraft("defi-rebalancer", now);
  const config = buildPermissionConfig({ ...draft, signer });

  assert.equal(draft.validityWindowEnabled, true);
  assert.equal(config.validUntil, Math.floor(now.getTime() / 1000) + 30 * 86_400);
});

test("stablecoin assistant prefills a monthly USDC budget", () => {
  const draft = createCapabilityPresetDraft("stablecoin-assistant", now);

  assert.equal(draft.tokenLimitsEnabled, true);
  assert.equal(draft.tokenLimits[0]?.symbol, "USDC");
  assert.equal(draft.tokenLimits[0]?.amount, "500");
  assert.deepEqual(draft.tokenLimits[0]?.period, { kind: "custom", seconds: 2_592_000 });
});

test("selector presets prefill whitelist rules", () => {
  const rebalancer = createCapabilityPresetDraft("defi-rebalancer", now);
  const claimer = createCapabilityPresetDraft("rewards-claimer", now);

  assert.equal(rebalancer.contractAccess, "whitelist");
  assert.equal(rebalancer.callRules[0]?.selector, "0x38ed1739");
  assert.equal(claimer.contractAccess, "whitelist");
  assert.equal(claimer.callRules[0]?.selector, "0x4e71d92d");
});
