import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const uiBrandFiles = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/components/shared/SiteHeader.tsx",
];

test("uses Wallexa as the visible application name", () => {
  for (const file of uiBrandFiles) {
    const source = readFileSync(join(process.cwd(), file), "utf8");

    assert.doesNotMatch(source, /AgentForce/);
  }

  const combinedSource = uiBrandFiles
    .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
    .join("\n");

  assert.match(combinedSource, /Wallexa/);
});

test("labels agent permission management as access keys", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/workforce/EmployeeManager.tsx"),
    "utf8",
  );

  assert.match(source, /Access keys/);
  assert.match(source, /Manage scoped agent keys for this smart account\./);
  assert.match(source, />\s*Add key\s*</);
  assert.doesNotMatch(source, /font-display[^>]*>Access keys</);
  assert.doesNotMatch(source, />Employees</);
  assert.doesNotMatch(source, />\s*Hire employee\s*</);
  assert.doesNotMatch(source, /Manage scoped agent signers for this smart account\./);
});

test("describes the workforce header with general access-key language", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/workforce/WorkforceHeader.tsx"),
    "utf8",
  );

  assert.match(source, /Welcome to your <span className="editorial text-accent">workforce\.<\/span>/);
  assert.match(source, /Create scoped access keys, set their budgets, and\s+revoke them with a click\./);
  assert.doesNotMatch(source, /Hire AI employees/);
  assert.doesNotMatch(source, /Welcome to your <span className="editorial text-accent">smart account\.<\/span>/);
});
