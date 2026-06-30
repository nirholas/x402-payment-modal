# Examples

Every example in [`../examples`](../examples) is runnable. They point at
placeholder endpoints (`https://api.example.com/…`) — swap in a real x402 endpoint
to take an actual payment. This page indexes them and shows the smallest snippet
for each integration style.

| Example | Shows | Run it |
| --- | --- | --- |
| [`plain-html/`](../examples/plain-html) | No build step. Declarative `data-x402-*` buttons, a programmatic `pay()` call, and `x402:result`/`x402:error` handling from one CDN `<script>`. | Open `index.html`, or `npx serve examples/plain-html`. |
| [`react/`](../examples/react) | Using the shipped `./react` wrapper (`X402Button`). | Copy `App.jsx` into your app — see [`react/README.md`](../examples/react/README.md). |
| [`server-express/`](../examples/server-express) | A full Express server mounting the Solana checkout router + a demo paid route that returns a real x402 v2 challenge. | `cd examples/server-express && npm install && npm start`, open http://localhost:3000. |
| [`solana-crypto-paywall/`](../examples/solana-crypto-paywall) | An end-to-end Solana paywall: a paid endpoint, the checkout server, and a local facilitator. | See its [`README.md`](../examples/solana-crypto-paywall/README.md). |

## Which do I need?

- **EVM payments** sign in the browser (EIP-3009) — the **plain-html** or
  **react** client is all you need, no server.
- **Solana payments** also need the checkout endpoint (**server-express** or
  **solana-crypto-paywall**) to build and wrap the transfer. See
  [server setup](./server-setup.md).

---

## 1. Plain HTML — declarative

The leanest integration: load the module and annotate a button. No JavaScript.

```html
<script type="module" src="https://unpkg.com/@three-ws/x402-payment-modal"></script>

<button
  data-x402-endpoint="https://api.example.com/paid/summarize"
  data-x402-method="POST"
  data-x402-body='{"url":"https://en.wikipedia.org/wiki/x402"}'
  data-x402-merchant="Acme"
  data-x402-action="Summarize">
  Summarize for $0.01
</button>

<script>
  document.addEventListener('x402:result', (e) => console.log('paid:', e.detail.result));
  document.addEventListener('x402:error',  (e) => console.error(e.detail.error));
</script>
```

## 2. Plain HTML — programmatic

```html
<script type="module">
  import { pay } from 'https://unpkg.com/@three-ws/x402-payment-modal';

  document.getElementById('go').addEventListener('click', async () => {
    try {
      const { result, payment } = await pay({
        endpoint: 'https://api.example.com/paid/translate',
        method: 'POST',
        body: { text: 'Hello', to: 'es' },
        merchant: 'Acme Translate',
        action: 'Translate',
      });
      console.log(result, 'tx:', payment?.transaction);
    } catch (err) {
      if (err.code !== 'cancelled') console.error(err);
    }
  });
</script>
```

## 3. React

```jsx
import { X402Button } from '@three-ws/x402-payment-modal/react';

export default function Demo() {
  return (
    <X402Button
      endpoint="/api/paid/summarize"
      method="POST"
      body={{ url: 'https://en.wikipedia.org/wiki/x402' }}
      merchant="Acme"
      action="Summarize"
      label="Summarize for $0.01"
      onResult={(r) => console.log('paid', r.payment)}
    />
  );
}
```

See the [React reference](./react.md) for the `useX402` hook and all props.

## 4. Express checkout server (Solana)

```js
import express from 'express';
import { x402CheckoutRouter } from '@three-ws/x402-payment-modal/server/express';

const app = express();
app.use(express.json());
app.use('/api/x402-checkout', x402CheckoutRouter({
  rpcUrls: [process.env.SOLANA_RPC_URL],   // dedicated RPC for production
}));
app.listen(3000);
```

Then point the client at it:

```js
import { configure } from '@three-ws/x402-payment-modal';
configure({ checkoutOrigin: 'https://your-server.com' });
```

Full server guide: [server setup](./server-setup.md).

## 5. Building a 402 challenge with `solanaAccept`

On the merchant side, build spec-shaped accepts (USDC default, optional second
token for a picker):

```js
import { solanaAccept } from '@three-ws/x402-payment-modal/server';

const common = { payTo, feePayer, maxTimeoutSeconds: 60 };
const accepts = [
  solanaAccept({ token: 'usdc', uiAmount: 0.01, ...common }), // $0.01 USDC
  // Optional: offer a second SPL token → the modal shows a picker.
  // solanaAccept({ token: 'three', uiAmount: 1000, ...common }),
];

res.status(402).json({ x402Version: 2, accepts });
```

## See also

- [Tutorial](../TUTORIAL.md) — build a paid endpoint end-to-end.
- [API reference](./api-reference.md) · [Server setup](./server-setup.md) ·
  [React reference](./react.md) · [Architecture](./architecture.md)
