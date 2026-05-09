import assert from "node:assert/strict";
import test from "node:test";
import { shouldPreserveFireflyConnectionOnUnmount } from "./useFireflyDelegation";

test("preserves the hardware wallet connection after successful delegation for route handoff", () => {
  assert.equal(shouldPreserveFireflyConnectionOnUnmount("confirmed"), true);
  assert.equal(shouldPreserveFireflyConnectionOnUnmount("broadcasting"), false);
  assert.equal(shouldPreserveFireflyConnectionOnUnmount("error"), false);
});
