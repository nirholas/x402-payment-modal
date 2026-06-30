# Server setup

The server module exists for **one reason: the Solana payment rail.** It exposes
`prepare`/`encode` endpoints that build and wrap the SPL transaction Phantom
signs. If your endpoint only accepts EVM stablecoins (e.g. USDC on Base), you do
**not** need any of this — see why below.

For the full request lifecycle, see [architecture](./architecture.md). For the
client side, see the [API reference](./api-reference.md).

```js
import {
  prepareSolanaCheckout,
  encodeX402Payment,
  handleCheckout,
  CheckoutError,
  isSolanaNetwork,
  X402_VERSION,             // 2
  NETWORK_SOLANA_MAINNET,
  NETWORK_SOLANA_DEVNET,
} from '@nirholas/x402-payment-modal/server';
```

## Why EVM needs no server, but Solana does

- **EVM (EIP-3009):** the browser wallet signs an EIP-712 typed-data
  authorization entirely client-side. No funds move at signing time, and no
  server is contacted. The signature becomes the `X-PAYMENT` header directly.
- **Solana:** Phantom only signs *serialized transactions*, not arbitrary typed
  data. Something has to build that transaction. The server builds a partially
  signed `transferChecked` v0 transaction (`prepare`), the buyer signs it, then
  the server wraps the signed tx into the x402 v2 envelope (`encode`). The fee
  payer is a facilitator sponsor account, so the buyer needs only USDC — no SOL
  for gas.

## Install the peer dependencies

The Solana helpers require these **optional** peer deps. Install them only if you
mount the Solana checkout:

```bash
npm install @solana/web3.js@^1.95 @solana/spl-token@^0.4
```

EVM-only sites can skip this entirely.

## Environment variables

| Variable          | Purpose                                                        |
|-------------------|---------------------------------------------------------------|
| `SOLANA_RPC_URL`  | Mainnet RPC endpoint used to build/serialize the transaction. |

You may also pass `rpcUrl` (and `devnetRpcUrl`) explicitly to the adapters or to
`prepareSolanaCheckout`; explicit options take precedence over the env var.

## Mounting with Express

```js
import express from 'express';
import { x402CheckoutRouter } from '@nirholas/x402-payment-modal/server/express';

const app = express();
app.use(express.json());

app.use(
  '/api/x402-checkout',
  x402CheckoutRouter({
    rpcUrl: process.env.SOLANA_RPC_URL,
    // devnetRpcUrl: 'https://api.devnet.solana.com',
    // origin: 'https://yourapp.com',  // CORS allow-origin (default '*')
  })
);

app.listen(3000);
```

`x402CheckoutRouter({ rpcUrl?, devnetRpcUrl?, origin? })` returns an Express
`RequestHandler`. It sets permissive CORS by default (`origin: '*'`), answers
`OPTIONS` preflight, and requires `POST` for the actual calls.

## Mounting with Vercel / Next.js (pages API)

Create `api/x402-checkout.js` (or `pages/api/x402-checkout.js`) and re-export the
handler:

```js
// api/x402-checkout.js
import { createVercelCheckoutHandler } from '@nirholas/x402-payment-modal/server/vercel';

export default createVercelCheckoutHandler({
  rpcUrl: process.env.SOLANA_RPC_URL,
  // devnetRpcUrl: process.env.SOLANA_DEVNET_RPC_URL,
  // origin: 'https://yourapp.com',
});
```

`createVercelCheckoutHandler()` is also the module's default export, so the
zero-config form works too:

```js
// api/x402-checkout.js
export { default } from '@nirholas/x402-payment-modal/server/vercel';
```

Like the Express adapter, it applies permissive CORS by default, handles
`OPTIONS`, and requires `POST`.

> Point the client at this endpoint with `configure({ checkoutOrigin, checkoutPath })`
> or the `data-x402-checkout-origin` / `data-x402-checkout-path` script
> attributes. See the [API reference](./api-reference.md#configure).

## From scratch with Node `http` + `handleCheckout`

`handleCheckout` is the framework-agnostic router. Pass it the `action`
(`'prepare'` or `'encode'`), the parsed JSON `body`, and optional `options`. It
returns `{ status, body }`, mapping a thrown `CheckoutError` to its `.status` and
any unexpected error to `502`. It accepts both camelCase and snake_case body
fields (`signed_tx_base64`/`signedTxBase64`, `resource_url`/`resourceUrl`,
`builder_code`/`builderCode`).

```js
import { createServer } from 'node:http';
import { handleCheckout } from '@nirholas/x402-payment-modal/server';

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action'); // 'prepare' | 'encode'

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, cors).end();
    return;
  }

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    const body = raw ? JSON.parse(raw) : {};
    const { status, body: out } = await handleCheckout({
      action,
      body,
      options: { rpcUrl: process.env.SOLANA_RPC_URL },
    });
    res.writeHead(status, { 'content-type': 'application/json', ...cors });
    res.end(JSON.stringify(out));
  });
});

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

server.listen(3000);
```

## CORS notes

Both adapters default to `origin: '*'` so a paywall served from one domain can
talk to a checkout server on another. For production, pass your site's origin:

```js
x402CheckoutRouter({ rpcUrl: process.env.SOLANA_RPC_URL, origin: 'https://yourapp.com' });
```

## Request / response shapes

### `?action=prepare`

`prepareSolanaCheckout({ accept, buyer, rpcUrl?, devnetRpcUrl? })` builds a
partially signed v0 transaction whose fee payer is `accept.extra.feePayer`.

Request:

```json
{
  "accept": {
    "network": "solana",
    "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "maxAmountRequired": "50000",
    "payTo": "So111SyntheticMerchantPlaceholder1111111111",
    "extra": { "feePayer": "So111SyntheticFeePayerPlaceholder11111111" }
  },
  "buyer": "So111SyntheticBuyerPlaceholder111111111111"
}
```

Response:

```json
{
  "network": "solana",
  "tx_base64": "AQAB...base64-serialized-v0-tx...",
  "recent_blockhash": "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
}
```

> `asset` above is the real Solana USDC mint (`EPjFW…Dt1v`). All other addresses
> are synthetic placeholders. Substitute your own facilitator and merchant
> accounts.

### `?action=encode`

`encodeX402Payment({ accept, signedTxBase64, resourceUrl, builderCode? })` wraps
the buyer-signed transaction into a base64 x402 v2 envelope (`X402_VERSION === 2`).

Request:

```json
{
  "accept": { "network": "solana", "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  "signed_tx_base64": "AQAB...signed...",
  "resource_url": "https://api.example.com/premium",
  "builder_code": { "wallet": "examplewallet", "service": "example_api" }
}
```

Response:

```json
{ "x_payment": "eyJ4NDAyVmVyc2lvbiI6Mn0...base64-envelope..." }
```

The client puts `x_payment` into the `X-PAYMENT` header and retries the original
request.

## Helpers

| Export                     | Description                                                            |
|----------------------------|------------------------------------------------------------------------|
| `CheckoutError`            | `Error` subclass with `.status` and `.code`; mapped to HTTP by router. |
| `isSolanaNetwork(network)` | `true` for Solana mainnet/devnet network identifiers.                  |
| `X402_VERSION`             | `2` — the x402 envelope version produced by `encode`.                  |
| `NETWORK_SOLANA_MAINNET`   | Canonical Solana mainnet network id.                                   |
| `NETWORK_SOLANA_DEVNET`    | Canonical Solana devnet network id.                                    |
