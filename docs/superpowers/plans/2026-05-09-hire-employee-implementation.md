# Hire Employee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the workforce Hire Employee flow that creates, displays, updates, and revokes scoped agent keys through `AgentPermissionValidator`.

**Architecture:** Keep chain authority in `AgentPermissionValidator` and local-only presentation metadata in browser storage. Split contract encoding/normalization, local metadata, onchain reads, hardware-wallet transaction signing, and workforce UI into focused files so the modal and dashboard stay understandable.

**Tech Stack:** Next.js 15 app router, React 19 client components, TypeScript, viem, Firefly hardware wallet client, Base Sepolia, node:test, Tailwind CSS, lucide-react, DiceBear avatars.

---

## File Structure

Create:

- `src/lib/agent-permissions.ts`: validator ABI, permission form types, period/amount/selector conversion, calldata builders, summary helpers, and Base Sepolia token presets.
- `src/lib/agent-permissions.test.ts`: unit tests for calldata, period conversion, token/native amount parsing, selector validation, and access-mode validation.
- `src/lib/employee-metadata.ts`: browser-storage keying and pure metadata merge helpers for names, avatar seeds, and transaction hashes.
- `src/lib/employee-metadata.test.ts`: unit tests for account-scoped storage keys and metadata merging.
- `src/hooks/useAgentPermissionState.ts`: client hook for reading signers and permissions from the validator and joining them with local metadata.
- `src/hooks/useAgentPermissionTransactions.ts`: client hook for Firefly signing and broadcasting validator management transactions.
- `src/components/workforce/AgentAvatar.tsx`: deterministic DiceBear avatar from signer address.
- `src/components/workforce/PermissionSummary.tsx`: compact and detailed summaries for employee cards and dialogs.
- `src/components/workforce/HireEmployeeDialog.tsx`: create/update permission modal, including one-time private key reveal for creates.
- `src/components/workforce/EmployeeManager.tsx`: employee list, empty state wiring, view/update/revoke controls.
- `src/components/workforce/WorkforceDashboard.tsx`: client wrapper that owns loaded employees and passes the active count to the header.

Modify:

- `package.json`: add `@dicebear/core` and `@dicebear/collection`.
- `src/lib/config.ts`: add Base Sepolia WETH constant and token metadata constants.
- `src/components/workforce/WorkforceHeader.tsx`: accept `activeEmployees` as a prop instead of hardcoding `0`.
- `src/components/workforce/EmployeeEmptyState.tsx`: accept `onHire` and enable the button.
- `src/app/workforce/page.tsx`: render `WorkforceDashboard` inside `AgentReadyGate`.

---

### Task 1: Add Avatar Dependency And Token Config

**Files:**
- Modify: `package.json`
- Modify: `src/lib/config.ts`

- [ ] **Step 1: Install DiceBear packages**

Run:

```bash
pnpm add @dicebear/core @dicebear/collection
```

Expected: `package.json` and `pnpm-lock.yaml` include `@dicebear/core` and `@dicebear/collection`.

- [ ] **Step 2: Add WETH token config**

In `src/lib/config.ts`, add these exports below the USDC constants:

```ts
// WETH9 on Base Sepolia.
export const BASE_SEPOLIA_WETH_ADDRESS =
  "0x4200000000000000000000000000000000000006" as const;
export const BASE_SEPOLIA_WETH_DECIMALS = 18;
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Commit dependency and config**

Run:

```bash
git add package.json pnpm-lock.yaml src/lib/config.ts
git commit -m "feat: add employee avatar and token config"
```

---

### Task 2: Build Validator Permission Utilities

**Files:**
- Create: `src/lib/agent-permissions.ts`
- Create: `src/lib/agent-permissions.test.ts`

- [ ] **Step 1: Write failing tests for permission encoding and validation**

Create `src/lib/agent-permissions.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { decodeFunctionData, getAddress } from "viem";
import {
  AGENT_PERMISSION_VALIDATOR_ABI,
  BASE_SEPOLIA_TOKEN_PRESETS,
  buildPermissionConfig,
  buildRemovePermissionCalldata,
  buildSetPermissionCalldata,
  limitPeriodToSeconds,
  normalizeFunctionSelector,
  parseLimitAmount,
  validatePermissionDraft,
  type PermissionDraft,
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

test("converts reset periods to validator seconds", () => {
  assert.equal(limitPeriodToSeconds({ kind: "fixed" }), 0);
  assert.equal(limitPeriodToSeconds({ kind: "hourly" }), 3600);
  assert.equal(limitPeriodToSeconds({ kind: "daily" }), 86400);
  assert.equal(limitPeriodToSeconds({ kind: "weekly" }), 604800);
  assert.equal(limitPeriodToSeconds({ kind: "custom", seconds: "90" }), 90);
});

test("rejects invalid custom reset periods", () => {
  assert.throws(() => limitPeriodToSeconds({ kind: "custom", seconds: "0" }), /greater than 0/);
  assert.throws(() => limitPeriodToSeconds({ kind: "custom", seconds: "abc" }), /whole number/);
});

test("parses decimal limits using token decimals", () => {
  assert.equal(parseLimitAmount("1.25", 6), 1_250_000n);
  assert.equal(parseLimitAmount("0.05", 18), 50_000_000_000_000_000n);
  assert.throws(() => parseLimitAmount("", 18), /amount/i);
});

test("normalizes function selectors", () => {
  assert.equal(normalizeFunctionSelector("0xA9059CBB"), "0xa9059cbb");
  assert.throws(() => normalizeFunctionSelector("0x123"), /selector/i);
});

test("requires at least one call rule when whitelist-only is selected", () => {
  const errors = validatePermissionDraft(baseDraft({ contractAccess: "whitelist", callRules: [] }));
  assert.ok(errors.some((error) => error.includes("at least one contract")));
});

test("builds setPermission calldata for call-any access", () => {
  const config = buildPermissionConfig(
    baseDraft({
      contractAccess: "any",
      callRules: [],
    }),
  );
  const calldata = buildSetPermissionCalldata(config);
  const decoded = decodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    data: calldata,
  });

  assert.equal(decoded.functionName, "setPermission");
  assert.equal(decoded.args?.[0].signer, getAddress(signer));
  assert.equal(decoded.args?.[0].requireAllowedCall, false);
  assert.deepEqual(decoded.args?.[0].callRules, []);
});

test("builds setPermission calldata for whitelist selectors and limits", () => {
  const config = buildPermissionConfig(baseDraft());
  const calldata = buildSetPermissionCalldata(config);
  const decoded = decodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    data: calldata,
  });

  assert.equal(decoded.functionName, "setPermission");
  assert.equal(decoded.args?.[0].requireAllowedCall, true);
  assert.equal(decoded.args?.[0].callRules[0].target, getAddress(target));
  assert.equal(decoded.args?.[0].callRules[0].selector, "0xa9059cbb");
  assert.equal(decoded.args?.[0].callRules[0].allowAnySelector, false);
  assert.equal(decoded.args?.[0].nativeLimitEnabled, true);
  assert.equal(decoded.args?.[0].nativeLimit.amount, 50_000_000_000_000_000n);
  assert.equal(decoded.args?.[0].nativeLimit.period, 86400);
  assert.equal(decoded.args?.[0].tokenLimits[0].limit.amount, 25_500_000n);
  assert.equal(decoded.args?.[0].tokenLimits[0].limit.period, 604800);
});

test("builds removePermission calldata", () => {
  const calldata = buildRemovePermissionCalldata(signer);
  const decoded = decodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    data: calldata,
  });

  assert.equal(decoded.functionName, "removePermission");
  assert.equal(decoded.args?.[0], getAddress(signer));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test -- src/lib/agent-permissions.test.ts
```

Expected: FAIL because `src/lib/agent-permissions.ts` does not exist.

- [ ] **Step 3: Implement permission utility module**

Create `src/lib/agent-permissions.ts`:

```ts
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import {
  BASE_SEPOLIA_USDC_ADDRESS,
  BASE_SEPOLIA_USDC_DECIMALS,
  BASE_SEPOLIA_WETH_ADDRESS,
  BASE_SEPOLIA_WETH_DECIMALS,
} from "./config";

export const AGENT_PERMISSION_VALIDATOR_ABI = [
  {
    type: "function",
    name: "setPermission",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "signer", type: "address" },
          { name: "requireAllowedCall", type: "bool" },
          { name: "validAfter", type: "uint48" },
          { name: "validUntil", type: "uint48" },
          {
            name: "callRules",
            type: "tuple[]",
            components: [
              { name: "target", type: "address" },
              { name: "selector", type: "bytes4" },
              { name: "allowAnySelector", type: "bool" },
            ],
          },
          {
            name: "tokenLimits",
            type: "tuple[]",
            components: [
              { name: "token", type: "address" },
              {
                name: "limit",
                type: "tuple",
                components: [
                  { name: "amount", type: "uint256" },
                  { name: "period", type: "uint48" },
                ],
              },
            ],
          },
          { name: "nativeLimitEnabled", type: "bool" },
          {
            name: "nativeLimit",
            type: "tuple",
            components: [
              { name: "amount", type: "uint256" },
              { name: "period", type: "uint48" },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "removePermission",
    stateMutability: "nonpayable",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getSigners",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getPermissionCore",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "signer", type: "address" },
    ],
    outputs: [
      { name: "active", type: "bool" },
      { name: "requireAllowedCall", type: "bool" },
      { name: "validAfter", type: "uint48" },
      { name: "validUntil", type: "uint48" },
      { name: "nativeLimitEnabled", type: "bool" },
      {
        name: "nativeLimit",
        type: "tuple",
        components: [
          { name: "amount", type: "uint256" },
          { name: "period", type: "uint48" },
          { name: "lastReset", type: "uint48" },
          { name: "used", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getCallRules",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "signer", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "selector", type: "bytes4" },
          { name: "allowAnySelector", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getTokenLimits",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "signer", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "token", type: "address" },
          {
            name: "limit",
            type: "tuple",
            components: [
              { name: "amount", type: "uint256" },
              { name: "period", type: "uint48" },
              { name: "lastReset", type: "uint48" },
              { name: "used", type: "uint256" },
            ],
          },
          { name: "enabled", type: "bool" },
        ],
      },
    ],
  },
] as const;

export type LimitPeriod =
  | { kind: "fixed" }
  | { kind: "hourly" }
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "custom"; seconds: string };

export type TokenPreset = {
  symbol: "USDC" | "WETH" | "CUSTOM";
  label: string;
  address: Address;
  decimals: number;
};

export const BASE_SEPOLIA_TOKEN_PRESETS: TokenPreset[] = [
  {
    symbol: "USDC",
    label: "USDC",
    address: getAddress(BASE_SEPOLIA_USDC_ADDRESS),
    decimals: BASE_SEPOLIA_USDC_DECIMALS,
  },
  {
    symbol: "WETH",
    label: "WETH",
    address: getAddress(BASE_SEPOLIA_WETH_ADDRESS),
    decimals: BASE_SEPOLIA_WETH_DECIMALS,
  },
  {
    symbol: "CUSTOM",
    label: "Custom ERC20",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
  },
];

export type PermissionDraft = {
  signer: string;
  name: string;
  validAfter: string;
  validUntil: string;
  nativeLimitEnabled: boolean;
  nativeLimitAmount: string;
  nativeLimitPeriod: LimitPeriod;
  tokenLimits: TokenLimitDraft[];
  contractAccess: "any" | "whitelist";
  callRules: CallRuleDraft[];
};

export type TokenLimitDraft = {
  id: string;
  token: string;
  symbol: string;
  decimals: number;
  amount: string;
  period: LimitPeriod;
};

export type CallRuleDraft = {
  id: string;
  target: string;
  mode: "any" | "selector";
  selector: string;
};

export type LimitConfig = {
  amount: bigint;
  period: number;
};

export type PermissionConfig = {
  signer: Address;
  requireAllowedCall: boolean;
  validAfter: number;
  validUntil: number;
  callRules: {
    target: Address;
    selector: Hex;
    allowAnySelector: boolean;
  }[];
  tokenLimits: {
    token: Address;
    limit: LimitConfig;
  }[];
  nativeLimitEnabled: boolean;
  nativeLimit: LimitConfig;
};

export function limitPeriodToSeconds(period: LimitPeriod): number {
  if (period.kind === "fixed") return 0;
  if (period.kind === "hourly") return 3600;
  if (period.kind === "daily") return 86400;
  if (period.kind === "weekly") return 604800;

  if (!/^\d+$/.test(period.seconds)) {
    throw new Error("Custom reset period must be a whole number of seconds");
  }
  const seconds = Number(period.seconds);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error("Custom reset period must be greater than 0 seconds");
  }
  return seconds;
}

export function parseLimitAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Limit amount is required");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Limit amount must be a positive decimal number");
  }
  return decimals === 18 ? parseEther(trimmed) : parseUnits(trimmed, decimals);
}

export function normalizeFunctionSelector(value: string): Hex {
  const normalized = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]{8}$/.test(normalized)) {
    throw new Error("Function selector must be a bytes4 hex value like 0xa9059cbb");
  }
  return normalized as Hex;
}

function toUnixSeconds(value: string): number {
  if (!value.trim()) return 0;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error("Date must be valid");
  return Math.floor(ms / 1000);
}

export function validatePermissionDraft(draft: PermissionDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Agent name is required");
  if (!isAddress(draft.signer)) errors.push("Signer address is invalid");
  if (draft.nativeLimitEnabled && !draft.nativeLimitAmount.trim()) {
    errors.push("ETH limit amount is required");
  }
  if (draft.contractAccess === "whitelist" && draft.callRules.length === 0) {
    errors.push("Whitelist-only access requires at least one contract rule");
  }
  for (const limit of draft.tokenLimits) {
    if (!isAddress(limit.token) || getAddress(limit.token) === "0x0000000000000000000000000000000000000000") {
      errors.push(`${limit.symbol || "Token"} address is invalid`);
    }
    if (!limit.amount.trim()) errors.push(`${limit.symbol || "Token"} limit amount is required`);
  }
  for (const rule of draft.callRules) {
    if (!isAddress(rule.target)) errors.push("Contract whitelist target is invalid");
    if (rule.mode === "selector") {
      try {
        normalizeFunctionSelector(rule.selector);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  const validAfter = toUnixSeconds(draft.validAfter);
  const validUntil = toUnixSeconds(draft.validUntil);
  if (validUntil !== 0 && validUntil <= validAfter) {
    errors.push("Valid until must be after valid after");
  }
  return errors;
}

export function buildPermissionConfig(draft: PermissionDraft): PermissionConfig {
  const errors = validatePermissionDraft(draft);
  if (errors.length > 0) throw new Error(errors.join("; "));

  return {
    signer: getAddress(draft.signer),
    requireAllowedCall: draft.contractAccess === "whitelist",
    validAfter: toUnixSeconds(draft.validAfter),
    validUntil: toUnixSeconds(draft.validUntil),
    callRules:
      draft.contractAccess === "whitelist"
        ? draft.callRules.map((rule) => ({
            target: getAddress(rule.target),
            selector: rule.mode === "selector" ? normalizeFunctionSelector(rule.selector) : "0x00000000",
            allowAnySelector: rule.mode === "any",
          }))
        : [],
    tokenLimits: draft.tokenLimits.map((limit) => ({
      token: getAddress(limit.token),
      limit: {
        amount: parseLimitAmount(limit.amount, limit.decimals),
        period: limitPeriodToSeconds(limit.period),
      },
    })),
    nativeLimitEnabled: draft.nativeLimitEnabled,
    nativeLimit: {
      amount: draft.nativeLimitEnabled ? parseLimitAmount(draft.nativeLimitAmount, 18) : 0n,
      period: draft.nativeLimitEnabled ? limitPeriodToSeconds(draft.nativeLimitPeriod) : 0,
    },
  };
}

export function buildSetPermissionCalldata(config: PermissionConfig): Hex {
  return encodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    functionName: "setPermission",
    args: [config],
  });
}

export function buildRemovePermissionCalldata(signer: string): Hex {
  return encodeFunctionData({
    abi: AGENT_PERMISSION_VALIDATOR_ABI,
    functionName: "removePermission",
    args: [getAddress(signer)],
  });
}
```

- [ ] **Step 4: Run permission tests**

Run:

```bash
pnpm test -- src/lib/agent-permissions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit permission utilities**

Run:

```bash
git add src/lib/agent-permissions.ts src/lib/agent-permissions.test.ts
git commit -m "feat: add agent permission utilities"
```

---

### Task 3: Build Local Employee Metadata Storage

**Files:**
- Create: `src/lib/employee-metadata.ts`
- Create: `src/lib/employee-metadata.test.ts`

- [ ] **Step 1: Write failing metadata tests**

Create `src/lib/employee-metadata.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmployeeMetadataStorageKey,
  indexEmployeeMetadata,
  mergeEmployeeMetadata,
  serializeEmployeeMetadata,
  type EmployeeMetadata,
} from "./employee-metadata";

const account = "0x1111111111111111111111111111111111111111";
const validator = "0x2222222222222222222222222222222222222222";
const signer = "0x3333333333333333333333333333333333333333";

test("builds metadata key scoped to chain, account, and validator", () => {
  assert.equal(
    buildEmployeeMetadataStorageKey({ chainId: 84532, account, validator }),
    "agentforce:employee-metadata:v1:84532:0x1111111111111111111111111111111111111111:0x2222222222222222222222222222222222222222",
  );
});

test("serializes metadata as a stable array", () => {
  const metadata: EmployeeMetadata[] = [
    {
      signer,
      name: "Invoice assistant",
      avatarSeed: signer,
      createdAt: "2026-05-09T10:00:00.000Z",
      updatedAt: "2026-05-09T10:00:00.000Z",
      createTxHash: "0xabc",
    },
  ];

  assert.equal(JSON.parse(serializeEmployeeMetadata(metadata))[0].name, "Invoice assistant");
});

test("indexes metadata by lowercase signer", () => {
  const index = indexEmployeeMetadata([
    {
      signer,
      name: "Agent",
      avatarSeed: signer,
      createdAt: "2026-05-09T10:00:00.000Z",
      updatedAt: "2026-05-09T10:00:00.000Z",
    },
  ]);

  assert.equal(index.get(signer.toLowerCase())?.name, "Agent");
});

test("merges metadata by signer and preserves createdAt", () => {
  const merged = mergeEmployeeMetadata(
    [
      {
        signer,
        name: "Old name",
        avatarSeed: signer,
        createdAt: "2026-05-09T10:00:00.000Z",
        updatedAt: "2026-05-09T10:00:00.000Z",
      },
    ],
    {
      signer,
      name: "New name",
      avatarSeed: signer,
      createdAt: "2026-05-09T11:00:00.000Z",
      updatedAt: "2026-05-09T11:00:00.000Z",
      updateTxHash: "0xdef",
    },
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "New name");
  assert.equal(merged[0].createdAt, "2026-05-09T10:00:00.000Z");
  assert.equal(merged[0].updateTxHash, "0xdef");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test -- src/lib/employee-metadata.test.ts
```

Expected: FAIL because `src/lib/employee-metadata.ts` does not exist.

- [ ] **Step 3: Implement metadata module**

Create `src/lib/employee-metadata.ts`:

```ts
import { getAddress, type Address, type Hex } from "viem";

export const EMPLOYEE_METADATA_STORAGE_PREFIX = "agentforce:employee-metadata:v1";

export type EmployeeMetadata = {
  signer: Address;
  name: string;
  avatarSeed: string;
  createdAt: string;
  updatedAt: string;
  createTxHash?: Hex;
  updateTxHash?: Hex;
  revokeTxHash?: Hex;
};

export type EmployeeMetadataKeyOptions = {
  chainId: number;
  account: string;
  validator: string;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function buildEmployeeMetadataStorageKey({
  chainId,
  account,
  validator,
}: EmployeeMetadataKeyOptions): string {
  return [
    EMPLOYEE_METADATA_STORAGE_PREFIX,
    chainId,
    getAddress(account).toLowerCase(),
    getAddress(validator).toLowerCase(),
  ].join(":");
}

export function serializeEmployeeMetadata(metadata: EmployeeMetadata[]): string {
  return JSON.stringify(
    metadata.map((item) => ({
      ...item,
      signer: getAddress(item.signer),
    })),
  );
}

export function parseEmployeeMetadata(value: string | null): EmployeeMetadata[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as EmployeeMetadata[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && item.signer)
      .map((item) => ({
        ...item,
        signer: getAddress(item.signer),
      }));
  } catch {
    return [];
  }
}

export function indexEmployeeMetadata(metadata: EmployeeMetadata[]): Map<string, EmployeeMetadata> {
  return new Map(metadata.map((item) => [item.signer.toLowerCase(), item]));
}

export function mergeEmployeeMetadata(
  current: EmployeeMetadata[],
  next: EmployeeMetadata,
): EmployeeMetadata[] {
  const normalizedNext = { ...next, signer: getAddress(next.signer) };
  const index = current.findIndex(
    (item) => item.signer.toLowerCase() === normalizedNext.signer.toLowerCase(),
  );
  if (index === -1) return [...current, normalizedNext];

  const existing = current[index];
  const merged = [...current];
  merged[index] = {
    ...existing,
    ...normalizedNext,
    createdAt: existing.createdAt,
  };
  return merged;
}

export function readEmployeeMetadata(storage: StorageLike, key: string): EmployeeMetadata[] {
  return parseEmployeeMetadata(storage.getItem(key));
}

export function writeEmployeeMetadata(
  storage: StorageLike,
  key: string,
  metadata: EmployeeMetadata[],
): void {
  storage.setItem(key, serializeEmployeeMetadata(metadata));
}

export function upsertEmployeeMetadata(
  storage: StorageLike,
  key: string,
  metadata: EmployeeMetadata,
): EmployeeMetadata[] {
  const merged = mergeEmployeeMetadata(readEmployeeMetadata(storage, key), metadata);
  writeEmployeeMetadata(storage, key, merged);
  return merged;
}
```

- [ ] **Step 4: Run metadata tests**

Run:

```bash
pnpm test -- src/lib/employee-metadata.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all unit tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 6: Commit metadata utilities**

Run:

```bash
git add src/lib/employee-metadata.ts src/lib/employee-metadata.test.ts
git commit -m "feat: add employee metadata storage"
```

---

### Task 4: Read Validator Employees And Sign Management Transactions

**Files:**
- Create: `src/hooks/useAgentPermissionState.ts`
- Create: `src/hooks/useAgentPermissionTransactions.ts`

- [ ] **Step 1: Create onchain state hook**

Create `src/hooks/useAgentPermissionState.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, formatUnits, getAddress, isAddress, type Address } from "viem";
import {
  AGENT_PERMISSION_VALIDATOR_ABI,
  BASE_SEPOLIA_TOKEN_PRESETS,
} from "@/lib/agent-permissions";
import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { buildEmployeeMetadataStorageKey, indexEmployeeMetadata, readEmployeeMetadata } from "@/lib/employee-metadata";
import { getConfiguredAgentPermissionValidatorAddress } from "@/lib/kernel-modules";
import { baseSepoliaPublicClient } from "@/lib/rpc";

export type OnchainLimit = {
  amount: bigint;
  period: number;
  lastReset: number;
  used: bigint;
};

export type EmployeeCallRule = {
  target: Address;
  selector: `0x${string}`;
  allowAnySelector: boolean;
};

export type EmployeeTokenLimit = {
  token: Address;
  symbol: string;
  decimals: number;
  limit: OnchainLimit;
  enabled: boolean;
};

export type AgentEmployee = {
  signer: Address;
  name: string;
  avatarSeed: string;
  active: boolean;
  expired: boolean;
  requireAllowedCall: boolean;
  validAfter: number;
  validUntil: number;
  nativeLimitEnabled: boolean;
  nativeLimit: OnchainLimit;
  callRules: EmployeeCallRule[];
  tokenLimits: EmployeeTokenLimit[];
};

type LoadState = {
  employees: AgentEmployee[];
  loading: boolean;
  error?: string;
};

function tokenMeta(token: Address): { symbol: string; decimals: number } {
  const preset = BASE_SEPOLIA_TOKEN_PRESETS.find(
    (item) => item.address.toLowerCase() === token.toLowerCase(),
  );
  return preset ? { symbol: preset.symbol, decimals: preset.decimals } : { symbol: "ERC20", decimals: 18 };
}

function normalizeLimit(limit: {
  amount: bigint;
  period: number;
  lastReset: number;
  used: bigint;
}): OnchainLimit {
  return {
    amount: limit.amount,
    period: Number(limit.period),
    lastReset: Number(limit.lastReset),
    used: limit.used,
  };
}

export function formatLimitAmount(amount: bigint, decimals: number): string {
  const formatted = decimals === 18 ? formatEther(amount) : formatUnits(amount, decimals);
  return formatted.includes(".") ? formatted.replace(/\.?0+$/, "") : formatted;
}

export function useAgentPermissionState(authority?: string) {
  const account = useMemo(() => {
    if (!authority || !isAddress(authority)) return undefined;
    return getAddress(authority);
  }, [authority]);
  const validatorAddress = getConfiguredAgentPermissionValidatorAddress();
  const [state, setState] = useState<LoadState>({ employees: [], loading: true });

  const refresh = useCallback(async () => {
    if (!account || !validatorAddress) {
      setState({ employees: [], loading: false });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const signers = (await baseSepoliaPublicClient.readContract({
        address: validatorAddress,
        abi: AGENT_PERMISSION_VALIDATOR_ABI,
        functionName: "getSigners",
        args: [account],
      })) as Address[];

      const metadataKey =
        typeof window === "undefined"
          ? undefined
          : buildEmployeeMetadataStorageKey({
              chainId: BASE_SEPOLIA_CHAIN_ID,
              account,
              validator: validatorAddress,
            });
      const metadataIndex =
        metadataKey && typeof window !== "undefined"
          ? indexEmployeeMetadata(readEmployeeMetadata(window.localStorage, metadataKey))
          : new Map();

      const employees = await Promise.all(
        signers.map(async (signer) => {
          const [core, callRules, tokenLimits] = await Promise.all([
            baseSepoliaPublicClient.readContract({
              address: validatorAddress,
              abi: AGENT_PERMISSION_VALIDATOR_ABI,
              functionName: "getPermissionCore",
              args: [account, signer],
            }),
            baseSepoliaPublicClient.readContract({
              address: validatorAddress,
              abi: AGENT_PERMISSION_VALIDATOR_ABI,
              functionName: "getCallRules",
              args: [account, signer],
            }),
            baseSepoliaPublicClient.readContract({
              address: validatorAddress,
              abi: AGENT_PERMISSION_VALIDATOR_ABI,
              functionName: "getTokenLimits",
              args: [account, signer],
            }),
          ]);
          const [active, requireAllowedCall, validAfter, validUntil, nativeLimitEnabled, nativeLimit] = core;
          const metadata = metadataIndex.get(signer.toLowerCase());
          const now = Math.floor(Date.now() / 1000);

          return {
            signer,
            name: metadata?.name ?? `Agent ${signer.slice(0, 6)}`,
            avatarSeed: metadata?.avatarSeed ?? signer,
            active,
            expired: Number(validUntil) !== 0 && now > Number(validUntil),
            requireAllowedCall,
            validAfter: Number(validAfter),
            validUntil: Number(validUntil),
            nativeLimitEnabled,
            nativeLimit: normalizeLimit(nativeLimit),
            callRules: callRules.map((rule) => ({
              target: rule.target,
              selector: rule.selector,
              allowAnySelector: rule.allowAnySelector,
            })),
            tokenLimits: tokenLimits.map((limit) => {
              const meta = tokenMeta(limit.token);
              return {
                token: limit.token,
                symbol: meta.symbol,
                decimals: meta.decimals,
                enabled: limit.enabled,
                limit: normalizeLimit(limit.limit),
              };
            }),
          } satisfies AgentEmployee;
        }),
      );

      setState({ employees, loading: false });
    } catch (error) {
      setState({
        employees: [],
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [account, validatorAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...state,
    account,
    validatorAddress,
    refresh,
  };
}
```

- [ ] **Step 2: Create management transaction hook**

Create `src/hooks/useAgentPermissionTransactions.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { FireflyClient } from "@/lib/firefly/firefly-client";
import { bytesToHex } from "@/lib/firefly/hex";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EXPLORER_TX,
} from "@/lib/config";
import {
  fromFireflyTransactionSignature,
  serializeSignedFireflyTransaction,
  toFireflyTransactionParams,
  type FireflyTransactionRequest,
} from "@/lib/kernel-modules";
import { getPendingNonce, baseSepoliaPublicClient } from "@/lib/rpc";
import { shortAddress } from "@/lib/utils";

export type PermissionTxStep =
  | "idle"
  | "connecting"
  | "preparing"
  | "awaitingDevice"
  | "broadcasting"
  | "confirmed"
  | "error";

export type PermissionTxState = {
  step: PermissionTxStep;
  hash?: Hex;
  error?: string;
};

export function useAgentPermissionTransactions(authority?: string) {
  const fireflyRef = useRef<FireflyClient | undefined>(undefined);
  const [state, setState] = useState<PermissionTxState>({ step: "idle" });

  useEffect(() => {
    return () => {
      void fireflyRef.current?.destroy().catch(() => undefined);
    };
  }, []);

  const reset = useCallback(() => setState({ step: "idle" }), []);

  const executeValidatorTransaction = useCallback(
    async ({ validator, data }: { validator: Address; data: Hex }): Promise<Hex> => {
      if (!authority || !isAddress(authority)) throw new Error("Missing authority account");
      const account = getAddress(authority);

      setState({ step: "connecting" });
      try {
        const firefly = await FireflyClient.discover(true);
        fireflyRef.current = firefly;

        const accounts = await firefly.sendMessage("ffx_accounts", []);
        if (!Array.isArray(accounts) || !(accounts[0] instanceof Uint8Array)) {
          throw new Error("Hardware wallet returned an invalid account response");
        }
        const deviceAddress = getAddress(bytesToHex(accounts[0]));
        if (deviceAddress !== account) {
          throw new Error(
            `Connected wallet ${shortAddress(deviceAddress)} does not match ${shortAddress(account)}`,
          );
        }

        setState({ step: "preparing" });
        const nonce = await getPendingNonce(account);
        const fees = await baseSepoliaPublicClient.estimateFeesPerGas();
        const estimatedGas = await baseSepoliaPublicClient.estimateGas({
          account,
          to: validator,
          value: 0n,
          data,
        });

        const tx: FireflyTransactionRequest = {
          chainId: BigInt(BASE_SEPOLIA_CHAIN_ID),
          nonce,
          gasLimit: estimatedGas + estimatedGas / 5n + 10_000n,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
          to: validator,
          value: 0n,
          data,
        };

        setState({ step: "awaitingDevice" });
        const rawSignature = await firefly.sendMessage(
          "ffx_signTransaction",
          toFireflyTransactionParams(tx),
        );
        const rawTransaction = serializeSignedFireflyTransaction(
          tx,
          fromFireflyTransactionSignature(rawSignature),
        );

        setState({ step: "broadcasting" });
        const response = await fetch("/api/broadcast-raw-transaction", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rawTransaction }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? `Broadcast failed (HTTP ${response.status})`);
        }

        const hash = payload.hash as Hex;
        setState({ step: "broadcasting", hash });
        const receipt = await baseSepoliaPublicClient.waitForTransactionReceipt({
          hash,
          pollingInterval: 2000,
          retryCount: 60,
          retryDelay: 2000,
        });
        if (receipt.status !== "success") {
          throw new Error("Permission transaction reverted on chain");
        }

        setState({ step: "confirmed", hash });
        return hash;
      } catch (error) {
        setState({
          step: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [authority],
  );

  return {
    state,
    reset,
    executeValidatorTransaction,
    explorerHref: state.hash ? `${BASE_SEPOLIA_EXPLORER_TX}/${state.hash}` : undefined,
  };
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If viem returns readonly tuples that TypeScript does not infer cleanly, add narrow local type aliases in `useAgentPermissionState.ts` for `core`, `callRules`, and `tokenLimits` instead of using `any`.

- [ ] **Step 4: Commit hooks**

Run:

```bash
git add src/hooks/useAgentPermissionState.ts src/hooks/useAgentPermissionTransactions.ts
git commit -m "feat: add employee permission hooks"
```

---

### Task 5: Add Avatar And Permission Summary Components

**Files:**
- Create: `src/components/workforce/AgentAvatar.tsx`
- Create: `src/components/workforce/PermissionSummary.tsx`

- [ ] **Step 1: Create deterministic avatar component**

Create `src/components/workforce/AgentAvatar.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { identicon } from "@dicebear/collection";
import { cn } from "@/lib/utils";

export function AgentAvatar({
  seed,
  className,
}: {
  seed: string;
  className?: string;
}) {
  const src = useMemo(
    () =>
      createAvatar(identicon, {
        seed: seed.toLowerCase(),
        size: 96,
        backgroundColor: ["2dd4bf", "818cf8", "f472b6", "34d399"],
        radius: 12,
      }).toDataUri(),
    [seed],
  );

  return (
    <img
      src={src}
      alt=""
      className={cn("h-12 w-12 rounded-lg border border-border bg-secondary", className)}
    />
  );
}
```

- [ ] **Step 2: Create permission summary component**

Create `src/components/workforce/PermissionSummary.tsx`:

```tsx
"use client";

import { ShieldCheck, Infinity, LockKeyhole, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatLimitAmount, type AgentEmployee } from "@/hooks/useAgentPermissionState";

function periodLabel(period: number): string {
  if (period === 0) return "fixed";
  if (period === 3600) return "hour";
  if (period === 86400) return "day";
  if (period === 604800) return "week";
  return `${period}s`;
}

function validityLabel(employee: AgentEmployee): string {
  if (employee.validUntil === 0) return "No expiry";
  return `Until ${new Date(employee.validUntil * 1000).toLocaleString()}`;
}

export function PermissionSummary({ employee }: { employee: AgentEmployee }) {
  const native = employee.nativeLimitEnabled
    ? `${formatLimitAmount(employee.nativeLimit.amount, 18)} ETH / ${periodLabel(employee.nativeLimit.period)}`
    : "No ETH value";

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant={employee.expired ? "muted" : "success"}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {employee.expired ? "Expired" : "Active"}
        </Badge>
        <Badge variant={employee.requireAllowedCall ? "primary" : "accent"}>
          {employee.requireAllowedCall ? (
            <LockKeyhole className="h-3.5 w-3.5" />
          ) : (
            <Infinity className="h-3.5 w-3.5" />
          )}
          {employee.requireAllowedCall ? "Whitelist only" : "Any contract"}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryLine label="ETH" value={native} />
        <SummaryLine label="Window" value={validityLabel(employee)} />
      </div>

      {employee.tokenLimits.length > 0 ? (
        <div className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            Token limits
          </div>
          <div className="space-y-1">
            {employee.tokenLimits.map((limit) => (
              <div key={limit.token} className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {limit.symbol}
                </span>
                <span className="text-right font-medium">
                  {formatLimitAmount(limit.limit.amount, limit.decimals)} / {periodLabel(limit.limit.period)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit display components**

Run:

```bash
git add src/components/workforce/AgentAvatar.tsx src/components/workforce/PermissionSummary.tsx
git commit -m "feat: add employee display components"
```

---

### Task 6: Build Hire And Update Dialog

**Files:**
- Create: `src/components/workforce/HireEmployeeDialog.tsx`

- [ ] **Step 1: Create dialog with draft state, validation, and submit**

Create `src/components/workforce/HireEmployeeDialog.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Copy, ExternalLink, KeyRound, Plus, Save, Trash2 } from "lucide-react";
import { getAddress, type Address, type Hex } from "viem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BASE_SEPOLIA_TOKEN_PRESETS,
  buildPermissionConfig,
  buildSetPermissionCalldata,
  type CallRuleDraft,
  type PermissionDraft,
  type TokenLimitDraft,
} from "@/lib/agent-permissions";
import {
  buildEmployeeMetadataStorageKey,
  upsertEmployeeMetadata,
} from "@/lib/employee-metadata";
import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { useAgentPermissionTransactions } from "@/hooks/useAgentPermissionTransactions";
import { AgentAvatar } from "./AgentAvatar";

type Mode =
  | { kind: "create" }
  | { kind: "update"; signer: Address; initialName: string; avatarSeed: string };

export type HireEmployeeDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  authority: Address;
  validator: Address;
  mode: Mode;
  onComplete(): Promise<void> | void;
};

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function emptyDraft(signer = ""): PermissionDraft {
  return {
    signer,
    name: "",
    validAfter: "",
    validUntil: "",
    nativeLimitEnabled: false,
    nativeLimitAmount: "",
    nativeLimitPeriod: { kind: "daily" },
    tokenLimits: [],
    contractAccess: "any",
    callRules: [],
  };
}

function tokenLimitFromPreset(index = 0): TokenLimitDraft {
  const preset = BASE_SEPOLIA_TOKEN_PRESETS[index];
  return {
    id: newId("token"),
    token: preset.address,
    symbol: preset.symbol,
    decimals: preset.decimals,
    amount: "",
    period: { kind: "daily" },
  };
}

function emptyCallRule(): CallRuleDraft {
  return {
    id: newId("rule"),
    target: "",
    mode: "any",
    selector: "",
  };
}

export function HireEmployeeDialog({
  open,
  onOpenChange,
  authority,
  validator,
  mode,
  onComplete,
}: HireEmployeeDialogProps) {
  const [draft, setDraft] = useState<PermissionDraft>(() =>
    mode.kind === "update"
      ? { ...emptyDraft(mode.signer), name: mode.initialName }
      : emptyDraft(),
  );
  const [revealPrivateKey, setRevealPrivateKey] = useState<Hex | undefined>();
  const tx = useAgentPermissionTransactions(authority);
  const errors = useMemo(() => {
    try {
      buildPermissionConfig(draft);
      return [];
    } catch (error) {
      return error instanceof Error ? error.message.split("; ") : [String(error)];
    }
  }, [draft]);
  const avatarSeed = draft.signer || authority;

  async function submit() {
    const privateKey = mode.kind === "create" ? generatePrivateKey() : undefined;
    const signer = mode.kind === "create" ? privateKeyToAccount(privateKey).address : mode.signer;
    const finalDraft = {
      ...draft,
      signer,
      name: draft.name.trim(),
    };
    const config = buildPermissionConfig(finalDraft);
    const data = buildSetPermissionCalldata(config);
    const hash = await tx.executeValidatorTransaction({ validator, data });

    if (typeof window !== "undefined") {
      const now = new Date().toISOString();
      upsertEmployeeMetadata(
        window.localStorage,
        buildEmployeeMetadataStorageKey({
          chainId: BASE_SEPOLIA_CHAIN_ID,
          account: authority,
          validator,
        }),
        {
          signer: getAddress(signer),
          name: finalDraft.name,
          avatarSeed: signer,
          createdAt: now,
          updatedAt: now,
          ...(mode.kind === "create" ? { createTxHash: hash } : { updateTxHash: hash }),
        },
      );
    }

    await onComplete();
    if (privateKey) {
      setRevealPrivateKey(privateKey);
    } else {
      onOpenChange(false);
    }
  }

  function closeReveal() {
    setRevealPrivateKey(undefined);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <div className="flex items-start gap-4">
          <AgentAvatar seed={avatarSeed} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <DialogTitle>{mode.kind === "create" ? "Hire employee" : "Update employee"}</DialogTitle>
            <DialogDescription>
              Configure the limits that the validator will enforce onchain.
            </DialogDescription>
          </div>
        </div>

        {revealPrivateKey ? (
          <div className="space-y-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
            <Badge variant="accent">
              <KeyRound className="h-3.5 w-3.5" />
              One-time private key
            </Badge>
            <p className="text-sm text-muted-foreground">
              This private key is not stored. Losing it means creating a new employee key.
            </p>
            <code className="block break-all rounded-lg border border-border bg-background p-3 font-mono text-xs">
              {revealPrivateKey}
            </code>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => void navigator.clipboard.writeText(revealPrivateKey)}
              >
                <Copy className="h-4 w-4" />
                Copy key
              </Button>
              <Button type="button" variant="outline" onClick={closeReveal}>
                I saved it
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="grid gap-2">
              <span className="text-sm font-medium">Agent name</span>
              <input
                className="h-11 rounded-lg border border-input bg-secondary/40 px-3 text-sm outline-none focus:border-accent"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Invoice assistant"
              />
            </label>

            <section className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
              <div className="text-sm font-semibold">ETH limit</div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.nativeLimitEnabled}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nativeLimitEnabled: event.target.checked,
                    }))
                  }
                />
                Allow ETH value transfers
              </label>
              {draft.nativeLimitEnabled ? (
                <input
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
                  value={draft.nativeLimitAmount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nativeLimitAmount: event.target.value,
                    }))
                  }
                  placeholder="0.05"
                />
              ) : null}
            </section>

            <section className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Token limits</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      tokenLimits: [...current.tokenLimits, tokenLimitFromPreset(0)],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add token
                </Button>
              </div>
              {draft.tokenLimits.map((limit) => (
                <div key={limit.id} className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    value={limit.token}
                    onChange={(event) => {
                      const preset = BASE_SEPOLIA_TOKEN_PRESETS.find(
                        (item) => item.address === event.target.value,
                      );
                      setDraft((current) => ({
                        ...current,
                        tokenLimits: current.tokenLimits.map((item) =>
                          item.id === limit.id && preset
                            ? { ...item, token: preset.address, symbol: preset.symbol, decimals: preset.decimals }
                            : item,
                        ),
                      }));
                    }}
                  >
                    {BASE_SEPOLIA_TOKEN_PRESETS.map((preset) => (
                      <option key={preset.symbol} value={preset.address}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    value={limit.amount}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        tokenLimits: current.tokenLimits.map((item) =>
                          item.id === limit.id ? { ...item, amount: event.target.value } : item,
                        ),
                      }))
                    }
                    placeholder="100"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        tokenLimits: current.tokenLimits.filter((item) => item.id !== limit.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </section>

            <section className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
              <div className="text-sm font-semibold">Contract access</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    draft.contractAccess === "any" ? "border-accent bg-accent/10" : "border-border bg-background"
                  }`}
                  onClick={() => setDraft((current) => ({ ...current, contractAccess: "any" }))}
                >
                  Call any contract
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    draft.contractAccess === "whitelist" ? "border-accent bg-accent/10" : "border-border bg-background"
                  }`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      contractAccess: "whitelist",
                      callRules: current.callRules.length > 0 ? current.callRules : [emptyCallRule()],
                    }))
                  }
                >
                  Whitelist only
                </button>
              </div>
              {draft.contractAccess === "whitelist"
                ? draft.callRules.map((rule) => (
                    <div key={rule.id} className="grid gap-2 rounded-lg border border-border/60 p-3">
                      <input
                        className="h-10 rounded-lg border border-input bg-background px-3 font-mono text-sm"
                        value={rule.target}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            callRules: current.callRules.map((item) =>
                              item.id === rule.id ? { ...item, target: event.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="0x contract address"
                      />
                      <select
                        className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                        value={rule.mode}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            callRules: current.callRules.map((item) =>
                              item.id === rule.id ? { ...item, mode: event.target.value as "any" | "selector" } : item,
                            ),
                          }))
                        }
                      >
                        <option value="any">Any function</option>
                        <option value="selector">Specific selector</option>
                      </select>
                      {rule.mode === "selector" ? (
                        <input
                          className="h-10 rounded-lg border border-input bg-background px-3 font-mono text-sm"
                          value={rule.selector}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              callRules: current.callRules.map((item) =>
                                item.id === rule.id ? { ...item, selector: event.target.value } : item,
                              ),
                            }))
                          }
                          placeholder="0xa9059cbb"
                        />
                      ) : null}
                    </div>
                  ))
                : null}
            </section>

            {errors.length > 0 ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors[0]}
              </div>
            ) : null}

            {tx.state.error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tx.state.error}
              </div>
            ) : null}

            {tx.explorerHref ? (
              <a
                href={tx.explorerHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent"
              >
                View transaction <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={errors.length > 0 || tx.state.step === "awaitingDevice" || tx.state.step === "broadcasting"}>
                {mode.kind === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {mode.kind === "create" ? "Hire employee" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If the component is too large for comfortable maintenance after it compiles, split repeated token and call-rule row JSX into local helper components inside the same file before committing.

- [ ] **Step 3: Commit hire dialog**

Run:

```bash
git add src/components/workforce/HireEmployeeDialog.tsx
git commit -m "feat: add hire employee dialog"
```

---

### Task 7: Build Workforce Employee Manager

**Files:**
- Create: `src/components/workforce/EmployeeManager.tsx`
- Create: `src/components/workforce/WorkforceDashboard.tsx`
- Modify: `src/components/workforce/EmployeeEmptyState.tsx`
- Modify: `src/components/workforce/WorkforceHeader.tsx`
- Modify: `src/app/workforce/page.tsx`

- [ ] **Step 1: Enable empty-state hire button**

Modify `src/components/workforce/EmployeeEmptyState.tsx` so it accepts `onHire`:

```tsx
"use client";

import { motion } from "framer-motion";
import { Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmployeeEmptyState({ onHire }: { onHire: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="container py-12"
    >
      <div className="grid gap-8 rounded-2xl surface p-10 text-center md:p-14">
        <div className="mx-auto relative h-32 w-32">
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 blur-2xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-2 flex items-center justify-center rounded-full surface-glow">
            <Bot className="h-12 w-12 text-accent" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Hire your first AI employee
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Pick a role, set a budget, define a time window. Your hardware wallet signs once;
            the agent works inside the lines you draw.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={onHire}>
            <Plus className="h-4 w-4" />
            Hire employee
          </Button>
          <Button variant="ghost" size="lg" disabled>
            Import policy preset
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Make header active count configurable**

Modify the prop type in `src/components/workforce/WorkforceHeader.tsx`:

```tsx
type WorkforceHeaderProps = {
  authority?: string;
  activeEmployees?: number;
};
```

Replace the function signature:

```tsx
export function WorkforceHeader({ authority, activeEmployees = 0 }: WorkforceHeaderProps) {
```

Remove this line from inside the component:

```tsx
const activeEmployees = 0;
```

- [ ] **Step 3: Create employee manager**

Create `src/components/workforce/EmployeeManager.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { getAddress, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildRemovePermissionCalldata } from "@/lib/agent-permissions";
import {
  buildEmployeeMetadataStorageKey,
  upsertEmployeeMetadata,
} from "@/lib/employee-metadata";
import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { type AgentEmployee } from "@/hooks/useAgentPermissionState";
import { useAgentPermissionTransactions } from "@/hooks/useAgentPermissionTransactions";
import { shortAddress } from "@/lib/utils";
import { AgentAvatar } from "./AgentAvatar";
import { EmployeeEmptyState } from "./EmployeeEmptyState";
import { HireEmployeeDialog } from "./HireEmployeeDialog";
import { PermissionSummary } from "./PermissionSummary";

export function EmployeeManager({
  authority,
  validator,
  employees,
  loading,
  error,
  refresh,
}: {
  authority: Address;
  validator: Address;
  employees: AgentEmployee[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
}) {
  const [hiring, setHiring] = useState(false);
  const [viewing, setViewing] = useState<AgentEmployee | undefined>();
  const [updating, setUpdating] = useState<AgentEmployee | undefined>();
  const [revoking, setRevoking] = useState<AgentEmployee | undefined>();
  const tx = useAgentPermissionTransactions(authority);

  async function revoke(employee: AgentEmployee) {
    const hash = await tx.executeValidatorTransaction({
      validator,
      data: buildRemovePermissionCalldata(employee.signer),
    });
    if (typeof window !== "undefined") {
      const now = new Date().toISOString();
      upsertEmployeeMetadata(
        window.localStorage,
        buildEmployeeMetadataStorageKey({
          chainId: BASE_SEPOLIA_CHAIN_ID,
          account: authority,
          validator,
        }),
        {
          signer: getAddress(employee.signer),
          name: employee.name,
          avatarSeed: employee.avatarSeed,
          createdAt: now,
          updatedAt: now,
          revokeTxHash: hash,
        },
      );
    }
    setRevoking(undefined);
    await refresh();
  }

  if (loading) {
    return (
      <section className="container py-12">
        <div className="surface rounded-2xl p-8 text-sm text-muted-foreground">
          Loading employees...
        </div>
      </section>
    );
  }

  if (employees.length === 0) {
    return (
      <>
        <EmployeeEmptyState onHire={() => setHiring(true)} />
        <HireEmployeeDialog
          open={hiring}
          onOpenChange={setHiring}
          authority={authority}
          validator={validator}
          mode={{ kind: "create" }}
          onComplete={refresh}
        />
      </>
    );
  }

  return (
    <section className="container py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Employees</h2>
          <p className="text-sm text-muted-foreground">
            Onchain signer keys joined with local names and avatars.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setHiring(true)}>
            <Plus className="h-4 w-4" />
            Hire employee
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {employees.map((employee) => (
          <article key={employee.signer} className="surface rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <AgentAvatar seed={employee.avatarSeed} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold">{employee.name}</h3>
                  <Badge variant={employee.expired ? "muted" : "success"}>
                    {employee.expired ? "Expired" : "Active"}
                  </Badge>
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {shortAddress(employee.signer, 10, 8)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <PermissionSummary employee={employee} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewing(employee)}>
                <Eye className="h-4 w-4" />
                View
              </Button>
              <Button variant="outline" size="sm" onClick={() => setUpdating(employee)}>
                <Pencil className="h-4 w-4" />
                Update
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setRevoking(employee)}>
                <Trash2 className="h-4 w-4" />
                Revoke
              </Button>
            </div>
          </article>
        ))}
      </div>

      <HireEmployeeDialog
        open={hiring}
        onOpenChange={setHiring}
        authority={authority}
        validator={validator}
        mode={{ kind: "create" }}
        onComplete={refresh}
      />

      {updating ? (
        <HireEmployeeDialog
          open
          onOpenChange={(open) => {
            if (!open) setUpdating(undefined);
          }}
          authority={authority}
          validator={validator}
          mode={{
            kind: "update",
            signer: updating.signer,
            initialName: updating.name,
            avatarSeed: updating.avatarSeed,
          }}
          onComplete={async () => {
            setUpdating(undefined);
            await refresh();
          }}
        />
      ) : null}

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(undefined)}>
        <DialogContent>
          {viewing ? (
            <>
              <DialogTitle>{viewing.name}</DialogTitle>
              <DialogDescription className="font-mono">
                {viewing.signer}
              </DialogDescription>
              <PermissionSummary employee={viewing} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revoking)} onOpenChange={(open) => !open && setRevoking(undefined)}>
        <DialogContent>
          {revoking ? (
            <>
              <DialogTitle>Revoke {revoking.name}?</DialogTitle>
              <DialogDescription>
                This signs an onchain transaction that removes the employee signer from the validator.
              </DialogDescription>
              {tx.state.error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {tx.state.error}
                </div>
              ) : null}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setRevoking(undefined)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => void revoke(revoking)}>
                  <Trash2 className="h-4 w-4" />
                  Revoke employee
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

- [ ] **Step 4: Create workforce dashboard wrapper**

Create `src/components/workforce/WorkforceDashboard.tsx`:

```tsx
"use client";

import { getAddress, isAddress } from "viem";
import { WorkforceHeader } from "./WorkforceHeader";
import { EmployeeManager } from "./EmployeeManager";
import { PresetGallery } from "./PresetGallery";
import { useAgentPermissionState } from "@/hooks/useAgentPermissionState";

export function WorkforceDashboard({ authority }: { authority?: string }) {
  const normalizedAuthority = authority && isAddress(authority) ? getAddress(authority) : undefined;
  const { employees, loading, error, refresh, validatorAddress } =
    useAgentPermissionState(normalizedAuthority);

  return (
    <>
      <WorkforceHeader
        authority={normalizedAuthority}
        activeEmployees={employees.filter((employee) => employee.active && !employee.expired).length}
      />
      {normalizedAuthority && validatorAddress ? (
        <EmployeeManager
          authority={normalizedAuthority}
          validator={validatorAddress}
          employees={employees}
          loading={loading}
          error={error}
          refresh={refresh}
        />
      ) : null}
      <PresetGallery />
    </>
  );
}
```

- [ ] **Step 5: Render dashboard in workforce page**

Modify `src/app/workforce/page.tsx` imports:

```ts
import { WorkforceDashboard } from "@/components/workforce/WorkforceDashboard";
```

Remove these imports:

```ts
import { WorkforceHeader } from "@/components/workforce/WorkforceHeader";
import { EmployeeEmptyState } from "@/components/workforce/EmployeeEmptyState";
import { PresetGallery } from "@/components/workforce/PresetGallery";
```

Replace the ready children with:

```tsx
<Suspense>
  <WorkforceDashboard authority={params.authority} />
</Suspense>
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit workforce manager**

Run:

```bash
git add src/components/workforce/EmployeeManager.tsx src/components/workforce/WorkforceDashboard.tsx src/components/workforce/EmployeeEmptyState.tsx src/components/workforce/WorkforceHeader.tsx src/app/workforce/page.tsx
git commit -m "feat: add employee workforce manager"
```

---

### Task 8: Prefill Update Dialog From Onchain State

**Files:**
- Modify: `src/lib/agent-permissions.ts`
- Modify: `src/components/workforce/HireEmployeeDialog.tsx`
- Modify: `src/components/workforce/EmployeeManager.tsx`

- [ ] **Step 1: Add employee-to-draft conversion helper**

In `src/lib/agent-permissions.ts`, add:

```ts
export type EmployeePermissionSnapshot = {
  signer: Address;
  name: string;
  validAfter: number;
  validUntil: number;
  nativeLimitEnabled: boolean;
  nativeLimit: { amount: bigint; period: number };
  tokenLimits: {
    token: Address;
    symbol: string;
    decimals: number;
    limit: { amount: bigint; period: number };
  }[];
  requireAllowedCall: boolean;
  callRules: {
    target: Address;
    selector: Hex;
    allowAnySelector: boolean;
  }[];
};

export function secondsToLimitPeriod(seconds: number): LimitPeriod {
  if (seconds === 0) return { kind: "fixed" };
  if (seconds === 3600) return { kind: "hourly" };
  if (seconds === 86400) return { kind: "daily" };
  if (seconds === 604800) return { kind: "weekly" };
  return { kind: "custom", seconds: seconds.toString() };
}

export function formatDateTimeLocal(unixSeconds: number): string {
  if (unixSeconds === 0) return "";
  const date = new Date(unixSeconds * 1000);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function formatDraftAmount(amount: bigint, decimals: number): string {
  const value = decimals === 18 ? formatEther(amount) : formatUnits(amount, decimals);
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

export function employeeSnapshotToDraft(snapshot: EmployeePermissionSnapshot): PermissionDraft {
  return {
    signer: snapshot.signer,
    name: snapshot.name,
    validAfter: formatDateTimeLocal(snapshot.validAfter),
    validUntil: formatDateTimeLocal(snapshot.validUntil),
    nativeLimitEnabled: snapshot.nativeLimitEnabled,
    nativeLimitAmount: snapshot.nativeLimitEnabled
      ? formatDraftAmount(snapshot.nativeLimit.amount, 18)
      : "",
    nativeLimitPeriod: secondsToLimitPeriod(snapshot.nativeLimit.period),
    tokenLimits: snapshot.tokenLimits.map((limit, index) => ({
      id: `token-${index}-${limit.token.toLowerCase()}`,
      token: limit.token,
      symbol: limit.symbol,
      decimals: limit.decimals,
      amount: formatDraftAmount(limit.limit.amount, limit.decimals),
      period: secondsToLimitPeriod(limit.limit.period),
    })),
    contractAccess: snapshot.requireAllowedCall ? "whitelist" : "any",
    callRules: snapshot.callRules.map((rule, index) => ({
      id: `rule-${index}-${rule.target.toLowerCase()}`,
      target: rule.target,
      mode: rule.allowAnySelector ? "any" : "selector",
      selector: rule.allowAnySelector ? "" : rule.selector,
    })),
  };
}
```

Also import `formatEther` and `formatUnits` from `viem` at the top of the file.

- [ ] **Step 2: Use real update draft in dialog**

Modify `HireEmployeeDialog.tsx` so `mode` accepts a full draft:

```ts
type Mode =
  | { kind: "create" }
  | { kind: "update"; draft: PermissionDraft; avatarSeed: string };
```

Change initial state:

```ts
const [draft, setDraft] = useState<PermissionDraft>(() =>
  mode.kind === "update" ? mode.draft : emptyDraft(),
);
```

Change update submit signer:

```ts
const signer = mode.kind === "create" ? privateKeyToAccount(privateKey).address : mode.draft.signer;
```

- [ ] **Step 3: Pass converted draft from employee manager**

In `EmployeeManager.tsx`, import `employeeSnapshotToDraft`:

```ts
import { buildRemovePermissionCalldata, employeeSnapshotToDraft } from "@/lib/agent-permissions";
```

Update the update dialog mode:

```tsx
mode={{
  kind: "update",
  draft: employeeSnapshotToDraft(updating),
  avatarSeed: updating.avatarSeed,
}}
```

- [ ] **Step 4: Add tests for update conversion**

Append to `src/lib/agent-permissions.test.ts`:

```ts
import { employeeSnapshotToDraft, secondsToLimitPeriod } from "./agent-permissions";

test("converts validator seconds back to draft reset periods", () => {
  assert.deepEqual(secondsToLimitPeriod(0), { kind: "fixed" });
  assert.deepEqual(secondsToLimitPeriod(3600), { kind: "hourly" });
  assert.deepEqual(secondsToLimitPeriod(123), { kind: "custom", seconds: "123" });
});

test("converts employee snapshot back to editable draft", () => {
  const draft = employeeSnapshotToDraft({
    signer,
    name: "Invoice assistant",
    validAfter: 0,
    validUntil: 0,
    nativeLimitEnabled: true,
    nativeLimit: { amount: 1_000_000_000_000_000_000n, period: 86400 },
    tokenLimits: [
      {
        token: BASE_SEPOLIA_TOKEN_PRESETS[0].address,
        symbol: "USDC",
        decimals: 6,
        limit: { amount: 10_000_000n, period: 604800 },
      },
    ],
    requireAllowedCall: true,
    callRules: [
      {
        target,
        selector: "0xa9059cbb",
        allowAnySelector: false,
      },
    ],
  });

  assert.equal(draft.nativeLimitAmount, "1");
  assert.equal(draft.tokenLimits[0].amount, "10");
  assert.equal(draft.callRules[0].selector, "0xa9059cbb");
  assert.equal(draft.contractAccess, "whitelist");
});
```

If duplicate import syntax appears after appending, merge the new named imports into the existing import block at the top of the test file.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm test -- src/lib/agent-permissions.test.ts
pnpm typecheck
```

Expected: PASS for both commands.

- [ ] **Step 6: Commit update prefill**

Run:

```bash
git add src/lib/agent-permissions.ts src/lib/agent-permissions.test.ts src/components/workforce/HireEmployeeDialog.tsx src/components/workforce/EmployeeManager.tsx
git commit -m "feat: prefill employee permission updates"
```

---

### Task 9: Polish Validation, Accessibility, And Copy

**Files:**
- Modify: `src/components/workforce/HireEmployeeDialog.tsx`
- Modify: `src/components/workforce/EmployeeManager.tsx`
- Modify: `src/components/workforce/PermissionSummary.tsx`

- [ ] **Step 1: Add reset-period controls to ETH and token limits**

In `HireEmployeeDialog.tsx`, add `type LimitPeriod` to the existing import from
`@/lib/agent-permissions`:

```ts
import {
  BASE_SEPOLIA_TOKEN_PRESETS,
  buildPermissionConfig,
  buildSetPermissionCalldata,
  type CallRuleDraft,
  type LimitPeriod,
  type PermissionDraft,
  type TokenLimitDraft,
} from "@/lib/agent-permissions";
```

In `HireEmployeeDialog.tsx`, add a shared local render helper above the component:

```tsx
function PeriodSelect({
  value,
  onChange,
}: {
  value: LimitPeriod;
  onChange(value: LimitPeriod): void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
      <select
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        value={value.kind}
        onChange={(event) => {
          const kind = event.target.value as LimitPeriod["kind"];
          onChange(kind === "custom" ? { kind, seconds: "" } : { kind });
        }}
      >
        <option value="fixed">Fixed cap</option>
        <option value="hourly">Resets hourly</option>
        <option value="daily">Resets daily</option>
        <option value="weekly">Resets weekly</option>
        <option value="custom">Custom seconds</option>
      </select>
      {value.kind === "custom" ? (
        <input
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          value={value.seconds}
          onChange={(event) => onChange({ kind: "custom", seconds: event.target.value })}
          placeholder="3600"
        />
      ) : null}
    </div>
  );
}
```

Render `PeriodSelect` next to `nativeLimitAmount` and for every token limit row.

- [ ] **Step 2: Add validity window inputs**

In `HireEmployeeDialog.tsx`, add a section before contract access:

```tsx
<section className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
  <div className="text-sm font-semibold">Validity window</div>
  <div className="grid gap-3 sm:grid-cols-2">
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Valid after</span>
      <input
        type="datetime-local"
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        value={draft.validAfter}
        onChange={(event) =>
          setDraft((current) => ({ ...current, validAfter: event.target.value }))
        }
      />
    </label>
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Valid until</span>
      <input
        type="datetime-local"
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        value={draft.validUntil}
        onChange={(event) =>
          setDraft((current) => ({ ...current, validUntil: event.target.value }))
        }
      />
    </label>
  </div>
</section>
```

- [ ] **Step 3: Add custom token address support**

In token rows, when `limit.symbol === "CUSTOM"`, render address and decimals inputs:

```tsx
{limit.symbol === "CUSTOM" ? (
  <div className="grid gap-2 sm:col-span-3 sm:grid-cols-[1fr_8rem]">
    <input
      className="h-10 rounded-lg border border-input bg-background px-3 font-mono text-sm"
      value={limit.token}
      onChange={(event) =>
        setDraft((current) => ({
          ...current,
          tokenLimits: current.tokenLimits.map((item) =>
            item.id === limit.id ? { ...item, token: event.target.value } : item,
          ),
        }))
      }
      placeholder="0x token contract"
    />
    <input
      className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
      value={limit.decimals}
      onChange={(event) =>
        setDraft((current) => ({
          ...current,
          tokenLimits: current.tokenLimits.map((item) =>
            item.id === limit.id ? { ...item, decimals: Number(event.target.value || 18) } : item,
          ),
        }))
      }
      placeholder="18"
    />
  </div>
) : null}
```

- [ ] **Step 4: Add transaction step labels**

In `HireEmployeeDialog.tsx`, change the transaction hook import to include the
step type:

```ts
import {
  useAgentPermissionTransactions,
  type PermissionTxStep,
} from "@/hooks/useAgentPermissionTransactions";
```

In `HireEmployeeDialog.tsx`, add:

```ts
function txStepLabel(step: PermissionTxStep): string {
  switch (step) {
    case "connecting":
      return "Connecting hardware wallet";
    case "preparing":
      return "Preparing transaction";
    case "awaitingDevice":
      return "Approve on hardware wallet";
    case "broadcasting":
      return "Broadcasting on Base Sepolia";
    case "confirmed":
      return "Confirmed";
    case "error":
      return "Transaction failed";
    default:
      return "";
  }
}
```

Show the label above the submit buttons whenever `tx.state.step !== "idle"`.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit polish**

Run:

```bash
git add src/components/workforce/HireEmployeeDialog.tsx src/components/workforce/EmployeeManager.tsx src/components/workforce/PermissionSummary.tsx
git commit -m "feat: polish employee permission forms"
```

---

### Task 10: Final Verification

**Files:**
- Verify repository state.

- [ ] **Step 1: Run unit tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS. If the build complains about missing runtime environment variables, keep the failure output and verify the feature with `pnpm typecheck` plus `pnpm test`.

- [ ] **Step 4: Start the dev server**

Run:

```bash
pnpm dev
```

Expected: Next.js starts on `http://127.0.0.1:3000`.

- [ ] **Step 5: Browser smoke test**

Open `http://127.0.0.1:3000/workforce?authority=<delegated-address>` with an address that has the validator installed.

Expected:

- readiness gate allows the page through
- header active employee count reflects `getSigners`
- empty state hire button opens the dialog
- `Call any contract` can submit with no whitelist rows
- `Whitelist only` cannot submit with zero whitelist rows
- USDC, WETH, and Custom ERC20 appear in token limit controls
- gas spend limit is not visible
- update flow does not reveal a private key
- revoke asks for confirmation

- [ ] **Step 6: Commit final fixes if any files changed**

If final verification required code changes, run:

```bash
git add <changed-files>
git commit -m "fix: complete employee permission verification"
```

If no files changed, do not create an empty commit.
