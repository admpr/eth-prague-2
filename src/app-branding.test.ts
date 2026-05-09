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
