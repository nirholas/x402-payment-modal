# Examples

Runnable examples for [`@three-ws/x402-payment-modal`](https://www.npmjs.com/package/@three-ws/x402-payment-modal)
— a zero-dependency, vanilla-JS payment modal for any x402 paid HTTP endpoint.

| Example | What it shows | Fastest way to try it |
| --- | --- | --- |
| [`plain-html/`](./plain-html) | No build step. Declarative `data-x402-*` buttons, a programmatic `pay()` call, and `x402:result` / `x402:error` event handling — all from a single CDN `<script>`. | Open `plain-html/index.html` in a browser (or serve the folder, e.g. `npx serve plain-html`). |
| [`react/`](./react) | The shipped `./react` wrapper — `<X402Button>` and the `useX402()` hook, both SSR-safe. | Copy `react/App.jsx` into your app — see [`react/README.md`](./react/README.md). |
| [`server-express/`](./server-express) | A complete Express server that mounts the Solana checkout router and serves a demo paid endpoint returning a real x402 v2 challenge. | `cd server-express && npm install && npm start`, then open http://localhost:3000 |
| [`solana-crypto-paywall/`](./solana-crypto-paywall) | End-to-end Solana paywall: a paid endpoint, the checkout server, and a local facilitator. | See [`solana-crypto-paywall/README.md`](./solana-crypto-paywall/README.md). |

## Which do I need?

- **EVM payments** sign in the browser (EIP-3009) — the **plain-html** or
  **react** client is all you need.
- **Solana payments** also require the **server-express** checkout endpoint to
  build and settle the transfer. See
  [`../docs/server-setup.md`](../docs/server-setup.md).

> The client examples point at placeholder endpoints
> (`https://api.example.com/...`). Swap in a real x402-enabled endpoint to take
> an actual payment.
