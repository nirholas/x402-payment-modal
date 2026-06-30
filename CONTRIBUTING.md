# Contributing to @nirholas/x402-payment-modal

Thanks for helping improve the drop-in x402 checkout. This guide covers the local
setup, the layout, and the bar for a change to land.

## Prerequisites

- Node.js **>= 18** (the package targets `engines.node >= 18`).
- npm (the repo uses npm; a lockfile-free `npm install` is fine).

## Setup

```bash
git clone https://github.com/nirholas/x402-payment-modal.git
cd x402-payment-modal
npm install
npm run build   # bundles dist/x402.js + dist/x402.min.js from src/index.js
npm test        # node --test — should report 14 pass / 2 skip
```

The two skipped tests (`prepareSolanaCheckout builds a tx …`) hit a **live Solana
RPC** and are skipped by default. To run them, point a real RPC at the test
environment per the comments in `test/token2022.integration.test.js`.

## Repository layout

| Path | What it is |
| --- | --- |
| `src/index.js` | The browser client — the `.` and `./min` exports. Zero runtime deps. |
| `server/checkout.js` | Framework-agnostic Solana checkout (`./server`). |
| `server/express.js`, `server/vercel.js` | Adapters (`./server/express`, `./server/vercel`). |
| `react/index.js` | React wrapper (`./react`): `X402Button`, `useX402`. |
| `types/*.d.ts` | TypeScript definitions for each subpath. |
| `build.mjs` | esbuild bundling `src` → `dist`. |
| `test/*.test.js` | `node --test` suites for the server helpers. |
| `docs/` | Reference docs (API, server, react, theming, caps, SIWX, architecture). |
| `examples/` | Runnable samples (plain HTML, React, Express, Solana paywall). |

## Making a change

1. **Match the existing patterns.** Read the neighboring code/docs first; keep the
   naming, file organization, and comment style consistent.
2. **No mocks, no placeholders, no TODOs.** Use real APIs. Every code sample in a
   doc must actually run; every link must resolve.
3. **Keep the client dependency-free.** The `.` export must not gain a runtime
   dependency. Crypto helpers are lazy-loaded from a CDN on demand only.
4. **Keep peer deps optional.** `@solana/web3.js`, `@solana/spl-token`, `express`,
   and `react` stay in `peerDependenciesMeta` as `optional: true`.
5. **Update the types.** A public API change must update the relevant `types/*.d.ts`.
6. **Document it.** A new option, export, or subpath updates the matching doc in
   `docs/` (and `README.md` / `CHANGELOG.md` for anything user-visible).

## Before opening a PR

```bash
npm run build && npm test
```

- `npm test` must stay **14 pass / 2 skip** (the 2 skips need a live RPC).
- If you touched `src/`, rebuild — `dist/` is generated and shipped.
- Review your own diff: every changed line should be justified.

## Commit & PR style

- Small, focused commits with a clear subject (`fix:`, `feat:`, `docs:` …).
- Describe the *why*, not just the *what*. Link the issue if there is one.
- For a behavior change, add or update a test.

## Reporting bugs

Open an issue at <https://github.com/nirholas/x402-payment-modal/issues> with:

- The subpath involved (`.`, `./server`, `./react`, …).
- A minimal reproduction (a paste of the 402 challenge JSON helps a lot).
- Browser + wallet (for client issues) or Node version + RPC (for server issues).

## License

By contributing you agree your contributions are licensed under the project's
[Apache-2.0](LICENSE) license.
