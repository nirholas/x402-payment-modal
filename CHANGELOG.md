# Changelog

All notable changes to `@three-ws/x402-payment-modal` are documented here. This
project adheres to [Semantic Versioning](https://semver.org).

## 1.0.0

Initial public release. Extracted from the three.ws platform as a standalone,
dependency-free package.

### Added

- **Drop-in payment modal** for any x402 paid endpoint — declarative
  (`data-x402-endpoint` auto-binding) and programmatic (`pay()` / `window.X402`).
- **Solana payments** via Phantom (USDC), backed by the bundled checkout server
  helpers (`prepare` / `encode`).
- **EVM payments** via any injected wallet (Base USDC, EIP-3009
  `transferWithAuthorization`) — signed entirely in the browser, no server call.
- **SIWX (Sign-In-With-X / CAIP-122) re-entry** — wallets that already paid can
  sign in instead of paying again, with automatic fallback to the pay flow.
- **Client-side spending caps** — per-call / hourly / daily limits enforced in
  `localStorage`, with rollback on failure.
- **`configure()` + script-tag `data-*` config** for checkout origin, branding,
  builder-code attribution, and esm.sh CDN URLs.
- **Framework-agnostic server module** with Express and Vercel adapters
  (`@three-ws/x402-payment-modal/server`).
- **Theming** — light + automatic dark mode, all classes overridable, `--x402-z`
  z-index custom property.
- **Automatic 429 throttle retry** — re-sends the same signed payment up to twice
  while an upstream rate limit resets (no double charge; payment isn't settled
  until the merchant call succeeds).
- TypeScript definitions, full docs (`docs/`), tutorial, and runnable examples
  (plain HTML, React, Express).
