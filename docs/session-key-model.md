# Session Key Model

## Purpose

Session keys are limited sub-keys for agents, bots, apps, or automation tasks. They are intentionally less powerful than the root hardware wallet.

The user should be able to create a key, understand what it can do, give it to an agent, and revoke it later.

## Key Lifecycle

Create:
The browser generates a fresh private key locally and derives the public address.

Configure:
The user selects permissions, limits, expiration, and labels.

Approve:
The hardware wallet approves the session creation action.

Reveal:
The app shows the generated private key once. The app should not persist it.

Use:
The agent signs actions with the session key. The smart account accepts only actions that match the configured policy.

Update:
The user can change permissions by submitting a management action from the root wallet.

Revoke:
The user disables the session key. Future agent actions fail even if the agent still has the private key.

Expire:
The key stops working outside its configured time window.

## MVP Permission Types

The MVP supports only these permission types.

Token spending:
Limit how much ERC20 value a key can transfer or approve.

Native spending:
Limit ETH value sent from the account.

Contract allowlist:
Allow calls only to selected contract addresses.

Function allowlist:
Allow only selected function selectors on selected contracts.

Time window:
Limit start and end timestamps.

## Example Presets

Stablecoin assistant:

- Token: USDC or USDT.
- Limit: selected max transferable/approvable amount.
- Contracts: selected token contract and optional target app contracts.
- Functions: ERC20 `transfer` and/or `approve`, plus selected app function selectors if needed.
- Time window: selected start and end.

DeFi rebalancer:

- Contracts: selected protocol routers.
- Functions: swap/deposit/withdraw selectors.
- Token limit: selected assets only.
- Native value limit: optional ETH cap.
- Time window: 24 hours or 7 days.

Rewards claimer:

- Contracts: selected reward contracts.
- Functions: claim-only selectors.
- Native value: zero.
- Time window: 30 days.

Game automation:

- Contracts: selected game contracts.
- Functions: gameplay actions.
- Token transfers: disabled.
- Native value: zero or selected ETH cap.
- Time window: session end.

Subscription payer:

- Contracts: selected merchant/subscription contract.
- Functions: payment or renewal function selectors.
- Token: selected stablecoin.
- Limit: monthly amount.
- Time window: renewal period.

## UI Requirements

The management page should show:

- Connected account.
- Delegation status.
- Session module status.
- Active keys.
- Expired keys.
- Revoked keys.
- Key name and public address.
- Permission summary.
- Expiration.
- Last used timestamp if available.
- Revoke button.

The creation flow should show:

- Key name.
- Agent/app purpose.
- Permission preset.
- Advanced permission editor.
- Human-readable risk summary.
- Hardware wallet approval step.
- One-time private key reveal step.

## One-Time Private Key Reveal

The generated private key should be displayed only after the session is successfully created.

The UI should make three things clear:

- The app will not show this private key again.
- Losing the key means the user must create a new session.
- If the key is exposed, the user should revoke it.

The private key should not be sent to analytics, logs, or a backend.

## Agent Integration Contract

For the later demo, the agent needs:

- Session private key.
- Chain ID.
- RPC URL.
- Account address.
- Session module execution format.
- Allowed task description.

The app should export a small JSON bundle without the private key by default, plus a separate one-time key copy.

Example:

```json
{
  "chainId": 11155111,
  "account": "0x...",
  "sessionAddress": "0x...",
  "permissions": [
    {
      "type": "erc20-spend-limit",
      "token": "0x...",
      "amount": "10"
    },
    {
      "type": "contract-allowlist",
      "contract": "0x...",
      "selectors": ["0x..."]
    },
    {
      "type": "time-window",
      "validAfter": 1710000000,
      "validUntil": 1710600000
    }
  ]
}
```
