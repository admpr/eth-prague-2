# Product Brief

Project name: TBD

## One-Liner

A hardware-wallet-rooted session key manager that lets users give AI agents limited onchain permissions without handing over full wallet control.

## Problem

AI agents are beginning to operate wallets: trading, claiming rewards, managing positions, paying invoices, minting assets, or interacting with apps on a user's behalf. The common setup is dangerous:

- Give the agent the private key to the main wallet.
- Create a separate wallet for the agent and manually refill it.
- Keep asking the user to sign every action, which removes most automation value.

The first option gives the agent too much power. The second fragments funds, permissions, reputation, and account history. The third is not really agent automation.

## Solution

The user connects a hardware wallet and signs an EIP-7702 authorization. That delegates the existing EOA to a modular smart account implementation while preserving the same address.

Once delegated, the user can create agent session keys with explicit onchain constraints:

- Which tokens the agent can spend.
- Daily or total spending limits.
- Which contracts and functions the agent can call.
- Which recipients are allowed.
- When the key expires.
- Whether the key can use a paymaster or only a defined gas budget.
- Whether the key can perform only a fixed number of actions.

The agent receives a private key, but the smart account enforces the boundaries onchain.

## Positioning

This is not a new wallet for agents. It is a permission layer for the user's existing wallet.

The hardware wallet remains the root authority. Session keys are disposable sub-keys for automation.

## First Network

Sepolia.

Sepolia is the first target because it is safe for testing real EIP-7702 delegation, account initialization, module installation, and session-key execution without mainnet risk.

## Users

Primary users:

- Crypto users who want agents to act from their existing address.
- Developers building agentic onchain apps.
- Teams that need constrained operational keys for bots and automation.

Secondary users:

- DeFi protocols that want safer agent integrations.
- Wallets that want to support programmable delegated permissions.
- Infrastructure providers building bundlers, paymasters, and account abstraction tooling.

## Core Use Cases

Agent spending limits:
An agent can spend up to a fixed daily amount of USDT, USDC, or ETH, but cannot drain the account.

Contract allowlists:
An agent can only interact with selected contracts, such as a specific DeFi protocol, game, subscription contract, or automation endpoint.

Function-level permissions:
An agent can call only selected functions, such as `claim`, `rebalance`, `swapExactTokensForTokens`, or `deposit`, while transfers or approvals remain blocked.

Time-boxed access:
An agent key expires after a defined date or after a short session window.

Task-specific keys:
The user creates one key per agent, app, or task. Each key has a name, purpose, and independent revocation path.

Reputation-preserving automation:
Transactions still originate from the user's existing address, preserving app permissions, reputation, allowlists, and history.

Emergency revocation:
The user can revoke one compromised agent key without moving assets or rotating the root hardware wallet.

## MVP Scope

The MVP focuses on management, not agent execution.

In scope:

- Connect hardware wallet.
- Sign EIP-7702 authorization.
- Broadcast delegation on Sepolia.
- Initialize a modular smart account.
- Install or configure a session-key module.
- Generate a session private key in the browser.
- Show the private key exactly once.
- Create named session keys with selected permissions.
- Support MVP permissions for ERC20 spending, native ETH spending, contract allowlists, function allowlists, and time windows.
- List active session keys.
- Revoke session keys.

Out of scope for MVP:

- A full hosted agent runtime.
- Mainnet support.
- Cross-chain session management.
- Social recovery or multisig root ownership.
- Long-term storage of generated private keys.

## Product Principles

Root authority stays offline:
The hardware wallet signs high-authority operations. Agent keys only receive constrained runtime permissions.

Boundaries are onchain:
The agent cannot bypass constraints by changing client software, prompt instructions, or backend code.

Keys are disposable:
Every agent key should be easy to create, label, inspect, expire, and revoke.

The user sees capabilities, not raw calldata:
The interface should explain what the agent can do in human terms.

No silent custody:
The app should not store agent private keys server-side. Browser-generated keys are shown once and then become the user's responsibility.

## Success Criteria

- A user can delegate their Sepolia EOA using a hardware wallet authorization.
- A user can create a constrained session key from the delegated account.
- The UI clearly shows what each key can and cannot do.
- A revoked key can no longer act.
- The architecture is reusable for future hardware wallet integrations.
