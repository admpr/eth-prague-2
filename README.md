# AgentForce

Hardware-wallet-rooted permission layer for AI agents. Delegate your Base Sepolia EOA to a smart account in one signature, then issue scoped session keys to agents.

This repo contains:

- **`/` (root)** — the product UI (Next.js 15 + React 19 + Tailwind + viem). The user-facing app.
- **`/poc`** — the original Vite proof of concept that proved the hardware-wallet → EIP-7702 → broadcast pipeline end to end. Still runnable.
- **`/docs`** — product brief, MVP architecture, session-key model.

## Run the product app

```sh
pnpm install
cp .env.local.example .env.local   # then set FIREFLY_RELAYER_PRIVATE_KEY
pnpm dev
```

Open `http://127.0.0.1:3000` in Chrome or Edge (Web Bluetooth requires a secure context; localhost qualifies).

Before first run, set `DELEGATE_CONTRACT_ADDRESS` in `src/lib/config.ts` to the smart-account implementation you've been delegating to in the POC. The flow refuses to start if it's still `0x000…`.

## Run the original POC

```sh
cd poc
pnpm install
pnpm dev
```

## Documentation

- [Product Brief](./docs/product-brief.md)
- [MVP Architecture](./docs/mvp-architecture.md)
- [Session Key Model](./docs/session-key-model.md)

## References

- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)
- [ERC-7579](https://erc7579.com/)
- [Rhinestone Smart Sessions](https://docs.rhinestone.dev/smart-wallet/smart-sessions/overview)
