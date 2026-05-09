import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  canClosePrivateKeyReveal,
  PrivateKeyReveal,
  txStepLabel,
} from "./HireEmployeeDialog";

const privateKey =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as const;

test("treats post-broadcast transactions as waiting for confirmation", () => {
  assert.equal(txStepLabel("confirming"), "Waiting for confirmation");
  assert.equal(canClosePrivateKeyReveal("confirming"), false);
  assert.equal(canClosePrivateKeyReveal("confirmed", true), false);
  assert.equal(canClosePrivateKeyReveal("confirmed"), true);
});

test("renders an agent-specific private key reveal with view and copy controls", () => {
  const browserGlobals = globalThis as Record<string, unknown>;
  const originalReact = browserGlobals.React;

  try {
    browserGlobals.React = React;
    const html = renderToStaticMarkup(
      createElement(PrivateKeyReveal, {
        agentName: "Invoice assistant",
        copied: false,
        privateKey,
        txStep: "confirming",
        onClose() {},
        onCopy() {},
      }),
    );

    assert.match(html, /Key for Invoice assistant/);
    assert.match(html, /Waiting for confirmation/);
    assert.match(html, /Show private key/);
    assert.match(html, /Copy key/);
    assert.doesNotMatch(html, new RegExp(privateKey.slice(2)));
  } finally {
    browserGlobals.React = originalReact;
  }
});
