# Hire Employee Permission Flow Design

## Context

The workforce screen is currently gated behind a delegated Kernel wallet with the
`AgentPermissionValidator` module installed. Once the wallet reaches that ready
state, the next product stage is to let the user hire an AI employee by creating
a scoped agent key, registering the key's public address onchain, and managing
the key from the workforce UI.

The contract source reviewed for this design is:

`/Users/adamprisenznak/www/eth-prague-contracts/src/AgentPermissionValidator.sol`

The validator supports:

- `setPermission(PermissionConfig)` for create and update.
- `removePermission(address signer)` for revoke.
- `getSigners(address account)` for listing registered signer addresses.
- `getPermissionCore`, `getCallRules`, and `getTokenLimits` for detail reads.
- validity windows through `validAfter` and `validUntil`.
- native ETH value limits through `nativeLimit`.
- ERC20 `transfer`, `approve`, and account-originating `transferFrom` spend
  limits through `tokenLimits`.
- contract and function allowlists through `requireAllowedCall` and
  `CallRule[]`.

The current validator does not meter actual gas paid by the smart account, so gas
spend limits are intentionally hidden in this stage.

## Selected Approach

Build a single Hire Employee modal on the existing `/workforce` screen, with
basic permissions visible first and advanced permissions available in the same
flow.

This is the MVP path because it makes the existing empty workforce screen useful
without introducing new routes or a separate staged/draft system. Presets can
later become shortcuts into this same flow.

## Core Flow

1. User reaches `/workforce` with delegation active and
   `AgentPermissionValidator` installed.
2. User clicks `Hire employee`.
3. The modal collects agent name and permission settings.
4. On submit, the browser generates a fresh secp256k1 private key locally.
5. The app derives the public signer address.
6. The app encodes a smart-account execution that calls
   `setPermission(PermissionConfig)` on the validator for that signer.
7. The hardware wallet signs the management transaction immediately.
8. The app broadcasts the signed transaction and waits for confirmation.
9. After confirmation, the app reveals the private key exactly once.
10. The app refreshes the onchain signer list and stores only local metadata in
    browser storage.

The private key is generated before the transaction so the public signer address
can be registered. The private key is not shown until the onchain registration is
confirmed.

## Permission Model

The basic editor maps directly to
`AgentPermissionValidator.PermissionConfig`.

Agent name:
Stored only in browser local storage.

Signer:
Generated in the browser from a fresh private key.

Validity window:
Optional start and end timestamps. Empty values map to `0` for the corresponding
validator fields.

ETH limit:
Maps to `nativeLimitEnabled` and `nativeLimit`. Fixed caps use `period = 0`.
Resetting caps use a period in seconds.

Token limits:
Maps to `tokenLimits[]`. Each row includes token address, display symbol,
decimals, amount, and reset period. The first preset tokens are:

- USDC on Base Sepolia:
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- WETH9 on Base Sepolia:
  `0x4200000000000000000000000000000000000006`
- Custom ERC20

USDT is excluded until there is a verified primary-source Base Sepolia address.

Reset behavior:

- fixed cap: `period = 0`
- hourly: `3600`
- daily: `86400`
- weekly: `604800`
- custom: user-entered seconds

Contract access:
The UI must make broad contract access explicit with a segmented control or radio
group.

- `Call any contract` maps to `requireAllowedCall = false` and no call rules.
- `Whitelist only` maps to `requireAllowedCall = true` and requires at least one
  valid contract rule before submit.

Whitelist rules:
Each rule has a target contract address and either:

- `any function`, mapping to `allowAnySelector = true`
- a specific `bytes4` selector, mapping to `allowAnySelector = false` and
  `selector = 0x....`

Advanced permissions:
The advanced section exposes function selector editing on top of the same
whitelist rule model. It does not introduce a separate permission system.

Gas spend limit:
Hidden for now because the current validator does not enforce gas metering.

## Employee List

The workforce screen should replace the disabled empty state with a real employee
manager.

The app reads `getSigners(account)` from the validator. For each signer, it reads:

- `getPermissionCore(account, signer)`
- `getCallRules(account, signer)`
- `getTokenLimits(account, signer)`

Each employee item shows:

- avatar
- local name
- signer address
- active or expired status
- ETH value limit summary
- token limit summary
- contract access mode
- validity window

If local metadata is missing, the UI falls back to a generated name such as
`Agent 0x1234` and a deterministic avatar seeded from the signer address.

## View, Update, Revoke

View:
Opens a detail modal with the full onchain permission summary and local metadata.

Update:
Opens the same Hire Employee modal prefilled from onchain permission state and
local metadata. It calls `setPermission(PermissionConfig)` with the same signer.
No private key is revealed during update.

Revoke:
Shows a confirmation state, then signs and broadcasts `removePermission(signer)`
from the hardware wallet. Once confirmed, the signer disappears from active
contract reads. Local metadata can be retained with a revoke transaction hash for
history, but it should not make a revoked key look active.

Every hire, update, and revoke operation is a real hardware-wallet-signed
transaction immediately. There is no local draft mode in this stage.

## Avatar Generation

Use a browser-friendly deterministic avatar library such as `@dicebear/core`
with an identicon/geometric style seeded by the signer address.

The generated avatar does not need to be stored as an image. Store only the seed
or derive it from the signer address each time.

## Local Storage

Local storage stores UI metadata only. The contract remains the source of truth
for active signers and permissions.

The storage key should include chain ID, account address, and validator address
so metadata does not leak across accounts or validator deployments.

Suggested metadata shape:

```ts
type EmployeeMetadata = {
  signer: `0x${string}`;
  name: string;
  avatarSeed: string;
  createdAt: string;
  updatedAt: string;
  createTxHash?: `0x${string}`;
  updateTxHash?: `0x${string}`;
  revokeTxHash?: `0x${string}`;
};
```

Private keys must never be written to local storage, cookies, server APIs,
analytics, logs, or durable application state.

## Transaction Mechanics

The implementation should add a small permission library around the validator
ABI and the account execution ABI:

- encode validator `setPermission(PermissionConfig)` calls
- encode validator `removePermission(address)` calls
- wrap validator calls in the smart account's execution calldata so the
  validator sees `msg.sender` as the smart account
- read and normalize contract permission state
- convert UI amounts to token units
- convert validator limits back to display amounts
- convert reset choices to and from seconds
- summarize permission risk in human-readable form

The signing and broadcast flow should reuse the existing module activation
pattern:

1. discover/connect Firefly hardware wallet
2. verify connected account matches the authority address
3. estimate gas for the transaction sent to the smart account
4. request `ffx_signTransaction`
5. serialize the signed transaction
6. broadcast through `/api/broadcast-raw-transaction`
7. wait for receipt
8. refresh contract state

For hire and update, the transaction is sent to the delegated account address.
The account execution target is the `AgentPermissionValidator`, and the inner
calldata is `setPermission(PermissionConfig)`. For revoke, the same pattern is
used with `removePermission(signer)`. The app must not send these calls directly
from the EOA to the validator, because the validator stores permissions under
`msg.sender`.

## One-Time Private Key Reveal

The reveal step happens only after a successful `setPermission` confirmation.

The UI should clearly communicate:

- the private key is shown only once
- losing it means creating a new employee key
- exposing it means revoking the employee key
- the app does not store it

The reveal modal can include a copy action and a final close confirmation. After
the modal is closed, the key should be removed from component state.

## Testing

Unit tests should cover:

- permission config encoding
- period conversion for fixed/hourly/daily/weekly/custom reset modes
- ETH and token amount parsing
- contract access mode validation
- selector validation
- local metadata storage keys
- joining onchain signer state with local metadata

UI tests or focused component tests should cover:

- hiring with call-any access
- preventing whitelist-only submit with no whitelist entries
- one-time private key reveal after success
- update without private key reveal
- revoke confirmation and refresh

## Out Of Scope

- gas spend limits
- USDT preset until a verified Base Sepolia address exists
- hosted agent runtime
- agent-side execution
- long-term private key storage
- dedicated employee detail routes
