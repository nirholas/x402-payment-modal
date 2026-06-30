# Solana crypto paywall — `@nirholas/x402-payment-modal` demo

A complete, runnable demo that paywalls a **free crypto-price API** (CoinGecko)
behind an **x402 USDC payment on Solana**, served to the payment modal we ship on
npm. It exists to prove the published modal works end to end on a plain page:

```
click ─▶ 402 challenge ─▶ Phantom connect ─▶ sign SPL transfer
      ─▶ PayAI /verify ─▶ fetch CoinGecko ─▶ PayAI /settle ─▶ prices + receipt
```

Three things make it a real test, not a mock:

1. **The modal loads from npm.** `public/index.html` pulls
   `https://unpkg.com/@nirholas/x402-payment-modal@1.2.0` — the exact artifact we
   publish — so you're testing the shipped code, not local source.
2. **The data is gated for real.** `/api/paid/crypto` returns live CoinGecko
   prices **only** after the payment verifies *and* settles on-chain via the
   [PayAI](https://facilitator.payai.network) facilitator. No payment, no data.
3. **The payout wallet is set at runtime.** There is no `.env` and no source
   constant for it — you start the server, paste a Solana address into the page,
   and that address becomes the `payTo` in the 402 challenge.

## Run it (inside this package's repo)

The server reuses the repo's `express` + `@solana/*` and imports the package's
checkout helpers from source, so no install is needed:

```bash
node examples/solana-crypto-paywall/server.mjs
# ▸ open http://localhost:4021
```

Then in the page:

1. **Set your payout wallet** — paste a base58 Solana address, click *Save*.
2. **Pick coins** — BTC / ETH / SOL / … (live from CoinGecko).
3. **Pay & unlock** — approve $0.01 USDC in Phantom. Prices + an on-chain
   receipt (with a Solscan link) appear when settlement lands.

> Paying is a **real Solana mainnet micropayment** — you need Phantom with a
> little USDC. The fee payer is covered by the facilitator, so you don't need SOL.

## Run it standalone (outside the repo)

```bash
npm install
# in server.mjs, change the two relative imports to the package subpaths:
#   '../../server/express.js'  →  '@nirholas/x402-payment-modal/server/express'
#   '../../server/checkout.js' →  '@nirholas/x402-payment-modal/server'
npm start
```

## What's runtime vs. fixed

| Thing | Where it comes from |
| --- | --- |
| **Payout wallet (`payTo`)** | **Set at runtime from the page** — `POST /api/config`, in memory. No env. |
| Fee-payer sponsor | Public PayAI account `2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4` (pays SOL fees; not a secret, not the payout). Override with `X402_FEE_PAYER_SOLANA` only if you change facilitators. |
| Facilitator | `https://facilitator.payai.network` (no API key). Override with `X402_FACILITATOR_URL`. |
| Solana RPC | Public mainnet RPC. Override with `SOLANA_RPC_URL` for anything beyond a quick try. |
| Price | Fixed at `$0.01` USDC. |
| Port | `4021`, or `PORT`. |

## Endpoints

| Method & path | Purpose |
| --- | --- |
| `GET /api/config` | Current payout wallet, fee payer, price, coin catalog. |
| `POST /api/config` `{ payTo }` | Set the payout wallet at runtime (validated Solana address). |
| `POST /api/paid/crypto` `{ ids }` | The paid resource. 402 until paid; verifies + settles, then returns live prices. |
| `ALL /api/x402-checkout` | The package's Solana `prepare`/`encode` router the modal calls. |

## Files

- `server.mjs` — Express app: runtime config, the 402 → verify → fetch → settle
  paid endpoint, and the package's checkout router.
- `facilitator.mjs` — minimal x402 `/verify` + `/settle` facilitator client (the
  merchant half of the protocol), implementing the standard x402 v2 wire format.
- `public/index.html` — the demo page: runtime payout panel, coin picker, and
  designed loading / empty / error / populated states with an on-chain receipt.
