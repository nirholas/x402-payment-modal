# Changelog

All notable changes to `@three-ws/x402-payment-modal` are documented here. This
project adheres to [Semantic Versioning](https://semver.org).

## 1.1.0

### Added

- **Pay in USDC _or_ THREE on Solana.** When a 402 challenge offers more than one
  Solana token, the modal renders a token picker so the buyer chooses which to
  pay in; the headline price and the built transaction follow the choice. USDC
  and [$THREE](https://three.ws/three-token) (`FeMb…pump`) are recognized by mint
  — correct symbol, decimals, and branding even when the `accept` omits
  `extra.name`/`extra.decimals`.
- **`solanaAccept()` server helper** — build a spec-shaped Solana `accept` from
  `token: 'usdc' | 'three'` (or an explicit `mint`) with the price as `uiAmount`
  (human) or `amount` (atomic). Exports `THREE_MINT`, `USDC_MINT_SOLANA`, and
  `WELL_KNOWN_SOLANA_TOKENS`.
- **`window.X402.tokens`** + client exports `THREE_MINT`, `USDC_MINT_SOLANA`,
  `KNOWN_SOLANA_TOKENS` for inline merchants composing challenges in the browser.

### Notes

- THREE is a utility token, not a stablecoin: the browser can't dollar-denominate
  it, so client-side spending caps apply to USDC only — enforce THREE caps
  server-side. Settlement is unchanged — the checkout endpoint already transfers
  any SPL mint named by the chosen `accept`.

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
