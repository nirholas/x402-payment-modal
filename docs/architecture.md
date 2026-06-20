# Architecture

`@three-ws/x402-payment-modal` is a single zero-dependency vanilla-JS ES module
that turns any [x402](https://x402.org)-protected HTTP endpoint into a one-click
checkout. It owns the entire client lifecycle: discovering the payment challenge,
connecting a wallet, signing the payment, retrying the request with proof, and
rendering a receipt plus the endpoint's result.

This document explains how the modal works end to end. For the public surface,
see the [API reference](./api-reference.md). For the Solana checkout backend, see
[server setup](./server-setup.md).

## The x402 flow in one sentence

> The merchant answers an unpaid request with **HTTP 402** describing what it
> wants; the modal makes the user **sign** a payment matching that description;
> the modal **retries** the same request with an `X-PAYMENT` header; the merchant
> **settles** the payment and returns the real result.

The package never holds funds and never moves money on its own. It only produces
a signed payment authorization and hands it back to the merchant, who settles it
through an x402 facilitator.

## Lifecycle

```
discover  →  connect  →  authorize  →  verify (retry + settle)  →  receipt
```

These map directly to the four visible modal steps:

| Step        | Modal label          | What happens                                                                 |
|-------------|----------------------|------------------------------------------------------------------------------|
| `discover`  | Confirming price     | Probe the endpoint, parse the 402 challenge, render price + network.         |
| `connect`   | Connect wallet       | Detect Phantom / EVM wallet, let the user pick and connect one.              |
| `authorize` | Authorize payment    | Produce a signed payment (EVM EIP-3009 typed-data, or Solana signed tx).     |
| `verify`    | Verify & complete    | Re-send the request with `X-PAYMENT`; merchant settles; show receipt.        |

Each step is rendered as a `.x402-step` element and carries `.x402-active`,
`.x402-done`, or `.x402-error` modifiers as it progresses. See
[theming](./theming.md) for styling hooks.

## Challenge discovery

When `pay()` first calls the endpoint (using the configured `method`, `body`, and
`headers`), it inspects the response for a payment challenge. It accepts any of:

1. **HTTP 402** with a JSON body describing the accepted payment(s).
2. **HTTP 402** with a `payment-required` response header (the body-less form).
3. **MCP-style HTTP 401** with a `payment-required` header — used by Model
   Context Protocol servers that gate tools behind payment.

The parsed challenge contains one or more `accepts` entries. Each entry names a
`network` (e.g. an EVM chain like Base, or a Solana network), an asset, an
amount, the pay-to address, and protocol `extra`/`extensions` metadata. If the
challenge advertises [SIWX](./siwx.md), the modal can offer sign-in re-entry
instead of a fresh payment.

If the very first response is **not** a payment challenge — e.g. an immediate
`200` (the endpoint isn't paid) or any other non-`402` status — discovery
**throws**: the modal renders the error on the `discover` step rather than
silently succeeding, since pointing the modal at a free or non-x402 endpoint is
almost always a misconfiguration worth surfacing.

## Two signing paths

x402 supports multiple settlement rails. The modal implements two, and which one
runs is decided entirely by the `network` in the selected `accepts` entry.

### EVM path — browser-only (EIP-3009)

EVM stablecoin payments (e.g. USDC on Base) use **EIP-3009** "transfer with
authorization." The browser wallet (MetaMask or any injected EIP-1193 provider)
signs an EIP-712 typed-data authorization. This is a pure signature — **no funds
move at signing time and no server call is made.** The signed authorization
becomes the `X-PAYMENT` header; the merchant's facilitator submits it on-chain
when it settles.

Because the signature is generated entirely in the browser, **EVM-only sites need
nothing on the server side** of this package.

### Solana path — server-assisted (prepare / encode + Phantom)

Phantom signs *serialized transactions*, not arbitrary typed data, so the Solana
path needs a small backend to build the transaction the wallet will sign. The
flow:

1. Client posts the selected `accepts` entry and the buyer's address to the
   checkout server: `POST /api/x402-checkout?action=prepare`.
2. The server builds a partially-signed SPL `transferChecked` v0 transaction.
   The **fee payer is a facilitator sponsor account** (`accept.extra.feePayer`),
   so the buyer needs only USDC — no SOL for gas.
3. The server returns `tx_base64` + `recent_blockhash`.
4. Phantom signs the transaction (`signTransaction`).
5. Client posts the signed tx to `?action=encode`; the server wraps it into a
   base64 x402 v2 payment envelope and returns `x_payment`.
6. That envelope becomes the `X-PAYMENT` header on the retry.

See [server setup](./server-setup.md) for mounting `prepare`/`encode`.

## Retry, settle, and the 429 auto-retry

Once a signed payment exists, the modal re-issues the original request with the
`X-PAYMENT` header attached. Outcomes:

- **2xx** — the merchant accepted and settled the payment. The modal parses the
  body (JSON or text), extracts any `payment`/receipt metadata from the response,
  renders the receipt + result, and resolves the `pay()` promise.
- **HTTP 429 (throttled)** — the facilitator was rate-limited. **Payment is not
  settled until the merchant call actually succeeds**, so it is safe to re-send
  the *same* signed payment. The modal auto-retries up to **2 additional times**
  with the identical `X-PAYMENT` payload before surfacing an error.
- **Other 4xx/5xx** — surfaced as an error in the modal (and via the
  `x402:error` event), with the reservation rolled back if
  [spending caps](./spending-caps.md) were in play.

This retry-on-429 is why the modal keeps the signed payment in memory rather than
re-prompting the wallet: re-signing is unnecessary and would annoy the user.

## Sequence diagram

```
 User        Modal              Merchant            Checkout server      Wallet
  |            |                    |                      |                |
  |  click     |                    |                      |                |
  |----------->| pay(opts)          |                      |                |
  |            |  GET/POST endpoint |                      |                |
  |            |------------------->|                      |                |
  |            |   402 + accepts    |                      |                |
  |            |<-------------------|                      |                |
  |            | [discover] price   |                      |                |
  |            |                    |                      |                |
  |            | [connect] pick wallet ------------------------------------>|
  |            |<----------------------------------------------- address    |
  |            |                    |                      |                |
  | == EVM path (browser-only) ==   |                      |                |
  |            | sign EIP-3009 typed data ----------------------------------->|
  |            |<-------------------------------------------- signature      |
  |            |                    |                      |                |
  | == Solana path (server-assisted) ==                    |                |
  |            | POST ?action=prepare ------------------->|                |
  |            |<------------------ tx_base64, blockhash --|                |
  |            | signTransaction ------------------------------------------>|
  |            |<-------------------------------- signed tx                  |
  |            | POST ?action=encode --------------------->|                |
  |            |<------------------------- x_payment ------|                |
  |            |                    |                      |                |
  |            | [verify] retry with X-PAYMENT             |                |
  |            |------------------->|                      |                |
  |            |  (429? re-send same payment, up to 2x)    |                |
  |            |   200 + result + receipt                  |                |
  |            |<-------------------|                      |                |
  |  receipt   |                    |                      |                |
  |<-----------| resolve PayResult  |                      |                |
```

## Cancellation

If the user closes the modal at any point, `pay()` rejects with an `Error` whose
`.code === 'cancelled'`. Any spending-cap reservation made for the attempt is
rolled back. Callers should treat `cancelled` as a no-op, not a failure.

## Distribution shape

- **Client:** one ES module (`src/index.js`), also shipped minified
  (`dist/x402.min.js`). It self-registers `window.X402` and auto-binds
  `[data-x402-endpoint]` elements. Crypto helpers (`@solana/web3.js`,
  noble hashes) are loaded on demand from CDN ESM and can be repointed for
  strict CSP via [`configure`](./api-reference.md#configure).
- **Server:** optional, only for the Solana rail. Exposed at
  `@three-ws/x402-payment-modal/server` with Express and Vercel adapters.
