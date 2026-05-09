import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HardwareWalletArt } from "./HardwareWalletArt";

test("shows an add-agent signing request on the hardware wallet screen", () => {
  const browserGlobals = globalThis as Record<string, unknown>;
  const originalReact = browserGlobals.React;

  try {
    browserGlobals.React = React;
    const html = renderToStaticMarkup(createElement(HardwareWalletArt));

    assert.match(html, /ADD AGENT/);
    assert.match(html, /Name: Robert/);
    assert.match(html, /Spend up to \$500\/day/);
    assert.match(html, /Sign transaction/);
    assert.doesNotMatch(html, /AUTHORIZE DELEGATION/);
    assert.doesNotMatch(html, /Smart EOA/);
  } finally {
    browserGlobals.React = originalReact;
  }
});
