import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const authority = "0x2222222222222222222222222222222222222222";
const validator = "0x1111111111111111111111111111111111111111";

test("keeps the first client render aligned with server HTML when readiness is cached", async () => {
  process.env.NEXT_PUBLIC_AGENT_PERMISSION_VALIDATOR_ADDRESS = validator;
  const [{ AgentReadyGate }, { buildAgentReadyCacheKey }, { DELEGATE_CONTRACT_ADDRESS }] =
    await Promise.all([
      import("./AgentReadyGate"),
      import("../../lib/kernel-modules"),
      import("../../lib/config"),
    ]);
  const browserGlobals = globalThis as Record<string, unknown>;
  const originalReact = browserGlobals.React;
  const originalWindow = browserGlobals.window;
  const readyCacheKey = buildAgentReadyCacheKey({
    authority,
    delegate: DELEGATE_CONTRACT_ADDRESS,
    validator,
  });
  const renderGate = () =>
    renderToString(
      createElement(AgentReadyGate, {
        authority,
        initialReady: false,
        children: createElement("div", { "data-testid": "dashboard" }, "dashboard"),
      }),
    );

  try {
    browserGlobals.React = React;
    browserGlobals.window = undefined;
    const serverHtml = renderGate();

    browserGlobals.window = {
      localStorage: {
        getItem: (key: string) => (key === readyCacheKey ? "ready" : null),
      },
      setTimeout,
    };

    assert.equal(renderGate(), serverHtml);
  } finally {
    browserGlobals.React = originalReact;
    browserGlobals.window = originalWindow;
  }
});
