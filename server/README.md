# Server — Solana checkout helpers

The modal's **EVM** path signs EIP-3009 typed-data in the browser and never calls
your server. The **Solana** path needs a small endpoint because Phantom signs
serialized transactions but doesn't build instructions: this module builds the
SPL `transferChecked` the buyer signs, then wraps the signed transaction into the
base64 `X-PAYMENT` envelope the x402 facilitator expects.

> If you only accept Base/EVM USDC, you don't need any of this.

## Install peer deps

```bash
npm install @solana/web3.js @solana/spl-token
```

## Mount it

**Express**

```js
import express from 'express';
import { x402CheckoutRouter } from '@three-ws/x402-payment-modal/server/express';

const app = express();
app.use(express.json());
app.use('/api/x402-checkout', x402CheckoutRouter({ rpcUrl: process.env.SOLANA_RPC_URL }));
```

**Vercel / Next.js** — `api/x402-checkout.js`

```js
export { default } from '@three-ws/x402-payment-modal/server/vercel';
// or, with options:
// import { createVercelCheckoutHandler } from '@three-ws/x402-payment-modal/server/vercel';
// export default createVercelCheckoutHandler({ rpcUrl: process.env.SOLANA_RPC_URL });
```

**Anything else** — use the core router:

```js
import { handleCheckout } from '@three-ws/x402-payment-modal/server';

const { status, body } = await handleCheckout({
  action: url.searchParams.get('action'), // 'prepare' | 'encode'
  body: await readJson(req),
  options: { rpcUrl: process.env.SOLANA_RPC_URL },
});
```

## Exports

| Export | Description |
| --- | --- |
| `prepareSolanaCheckout({ accept, buyer, rpcUrl?, devnetRpcUrl? })` | Build the partially-signed v0 transaction the buyer signs. |
| `encodeX402Payment({ accept, signedTxBase64, resourceUrl, builderCode? })` | Wrap the signed tx into the base64 `X-PAYMENT` envelope. |
| `handleCheckout({ action, body, options? })` | Route `prepare`/`encode`; returns `{ status, body }`. |
| `CheckoutError` | `Error` subclass with `.status` and `.code`. |
| `isSolanaNetwork(network)` | CAIP-2 / `solana` alias check. |
| `X402_VERSION`, `NETWORK_SOLANA_MAINNET`, `NETWORK_SOLANA_DEVNET` | Constants. |

Adapters: `./express` → `x402CheckoutRouter(options)`, `./vercel` →
`createVercelCheckoutHandler(options)` (default export is a ready handler). Both
set permissive CORS (`origin: '*'`) by default and handle the `OPTIONS`
preflight; pass `{ origin }` to restrict it.

See [../docs/server-setup.md](../docs/server-setup.md) for the request/response
shapes and environment variables.
