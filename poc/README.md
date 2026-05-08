# Hardware Wallet Agent Key Manager POC (archived)

> Archived POC. The active product UI lives at the repo root (Next.js). This Vite app remains here as the original end-to-end proof of concept and is still runnable from `poc/` with `pnpm install && pnpm dev`.

This project is a proof of concept for turning a hardware-wallet-controlled EOA into an EIP-7702 smart EOA, then managing constrained session keys for AI agents and automated apps.

The core idea is simple: the user's hardware wallet stays the root authority, while generated agent keys receive only the permissions the user explicitly grants onchain.

## Current POC

The current browser POC can:

- Connect to a custom hardware wallet firmware over Web Bluetooth.
- Ask the device to sign an EIP-7702 authorization.
- Verify the recovered authorization signer in the browser.
- Broadcast the authorization on Sepolia with a local funded broadcaster wallet.
- Confirm that the EOA now delegates to the selected smart account implementation.

The next phase is session-key management: create, display once, update, and revoke agent keys with scoped permissions.

## Run

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173` in Chrome or Edge. Web Bluetooth requires a secure context; `localhost` and `127.0.0.1` are treated as secure.

For local broadcasting, set a disposable Sepolia broadcaster key in `.env.local`:

```sh
FIREFLY_RELAYER_PRIVATE_KEY=0x...
```

The broadcaster key pays gas for the outer EIP-7702 transaction. It is not the hardware wallet authority.

## Documentation

- [Product Brief](./docs/product-brief.md)
- [MVP Architecture](./docs/mvp-architecture.md)
- [Session Key Model](./docs/session-key-model.md)

## Verification

```sh
pnpm test
pnpm build
```

## References

- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)
- [ERC-7579](https://erc7579.com/)
- [Rhinestone Smart Sessions](https://docs.rhinestone.dev/smart-wallet/smart-sessions/overview)
- [Rhinestone EIP-7702](https://docs.rhinestone.dev/smart-wallet/core/eip-7702)
