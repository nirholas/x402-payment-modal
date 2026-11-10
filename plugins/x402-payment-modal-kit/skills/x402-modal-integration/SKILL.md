---
name: x402-modal-integration
description: Integrate @three-ws/x402-payment-modal into a site: the browser modal, the React hook and button, and the Express or Vercel Solana checkout route it needs. Use when a web app must let users pay an x402 endpoint, in USDC or $THREE on Solana, from their wallet.
---

# Integrate the x402 payment modal

This plugin is a skill only. There is no MCP server. `@three-ws/x402-payment-modal` ships a browser modal, React bindings and the server helpers for the Solana checkout.

```
npm install @three-ws/x402-payment-modal
```

## Browser

```js
import { configure, pay, init } from '@three-ws/x402-payment-modal';

configure({ checkoutOrigin: null, checkoutPath: '/api/x402-checkout', theme: 'auto' });

const out = await pay({
  endpoint: '/api/paid/summarize',
  method: 'POST',
  body: { text: 'hello' },
  merchant: 'Acme',
  action: 'Summarize',
  caps: { maxPerCall: 100000, maxPerDay: 2000000 },
});
// out: { ok: true, result, payment?: { network, transaction, payer }, siwx?, response }
```

- `pay(opts)` needs `endpoint`. Other options: `method`, `body`, `headers`, `merchant`, `action`, `autoConnect`, `caps` (micro-USD, enforced per wallet in `localStorage`).
- `configure` keys: `checkoutOrigin`, `checkoutPath` (default `/api/x402-checkout`), `brand`, `footerNote`, `builderCode`, `esm`, `theme` (`auto`, `light`, `dark`), `cssVars`.
- `init()` binds `[data-x402-endpoint]` elements. A prebuilt script is exported as `@three-ws/x402-payment-modal/min`.
- Exports `USDC_MINT_SOLANA` and `THREE_MINT` for the two main Solana assets.

## React

```jsx
import { X402Button, useX402 } from '@three-ws/x402-payment-modal/react';

<X402Button endpoint="/api/paid/summarize" method="POST" body={{ text: 'hi' }}
            label="Pay and run" onResult={(r) => console.log(r.result)} onError={console.error} />
```

`useX402(defaults)` returns `{ pay, status, result, error, reset, isPaying }`, where `status` is `idle`, `paying`, `done` or `error`. `react` is a peer dependency (17 or newer).

## Solana checkout backend

The Solana path posts to `/api/x402-checkout?action=prepare` and `?action=encode` on your server. Mount one of the adapters:

```js
// Express
import { x402CheckoutRouter } from '@three-ws/x402-payment-modal/server/express';
app.use(express.json());
app.use('/api/x402-checkout', x402CheckoutRouter({ rpcUrl: process.env.SOLANA_RPC_URL }));
```

```js
// Vercel or Next.js pages API, api/x402-checkout.js
export { default } from '@three-ws/x402-payment-modal/server/vercel';
```

Options for both: `rpcUrl`, `rpcUrls` (failover), `devnetRpcUrl`, `devnetRpcUrls`, `logger`, `origin` (CORS, default `*`, tighten it to your own origin). The express adapter needs `@solana/web3.js` and `@solana/spl-token` peers.

To build the 402 challenge on the paid endpoint, import `solanaAccept({ token: 'usdc' | 'three', payTo, feePayer, amount })` from `@three-ws/x402-payment-modal/server`.

## Rules for the agent

- Use the user's real pay-to and fee-payer addresses. Do not invent them, and never put a private key in code. The buyer signs in their own wallet.
- Point the modal only at endpoints the user owns or named.
