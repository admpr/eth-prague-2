import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("frames the connect authorization as making the wallet agent-ready", () => {
  const connectSource = readFileSync(
    join(process.cwd(), "src/components/connect/ConnectStage.tsx"),
    "utf8",
  );
  const modalSource = readFileSync(
    join(process.cwd(), "src/components/connect/ProgressModal.tsx"),
    "utf8",
  );

  assert.match(connectSource, /title="Make wallet agent-ready"/);
  assert.match(
    connectSource,
    /Your hardware wallet stays in control\.[\s\S]*One on-device approval upgrades this\s+address on Base Sepolia[\s\S]*so Wallexa can issue scoped agent keys next\./,
  );
  assert.match(connectSource, /Sign & Make Agent-Ready/);
  assert.match(modalSource, /Wallet is agent-ready/);
  assert.match(modalSource, /Making wallet agent-ready/);

  assert.doesNotMatch(connectSource, /Sign & activate delegation/);
  assert.doesNotMatch(connectSource, /Sign & Activate Delegation/);
  assert.doesNotMatch(connectSource, /Delegating to/);
  assert.doesNotMatch(modalSource, /Delegation activated/);
  assert.doesNotMatch(modalSource, /Activating delegation/);
});
