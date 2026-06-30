# Tutorial: ship a paid endpoint with x402

This walks you from an empty folder to a working page where a user pays USDC to
call your API — using `@three-ws/x402-payment-modal` for the front end. It takes
about 15 minutes.

By the end you'll have:

1. A paid HTTP endpoint that answers `402` until it sees a valid payment.
2. A button that opens the payment modal and runs the call.
3. The Solana checkout endpoint the modal needs (skip this if you only take EVM).

> **Prerequisites:** Node 18+, and a browser with [Phantom](https://phantom.app)
> (Solana) and/or an EVM wallet like MetaMask. You'll need a little USDC on Base
> or Solana to test a real payment end-to-end.

---

## Part 1 — The front end (5 minutes)

Create `index.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Paid endpoint demo</title>
  </head>
  <body>
    <h1>Summarize anything — $0.01</h1>

    <button
      id="summarize"
      data-x402-endpoint="https://api.example.com/paid/summarize"
      data-x402-method="POST"
      data-x402-body='{"text":"The quick brown fox..."}'
      data-x402-merchant="Acme AI"
      data-x402-action="Summarize">
      Pay &amp; Summarize
    </button>

    <pre id="out"></pre>

    <script type="module" src="https://unpkg.com/@three-ws/x402-payment-modal"></script>
    <script>
      const out = document.getElementById('out');
      const btn = document.getElementById('summarize');
      btn.addEventListener('x402:result', (e) => {
        out.textContent = JSON.stringify(e.detail.result, null, 2);
      });
      btn.addEventListener('x402:error', (e) => {
        out.textContent = 'Error: ' + e.detail.error;
      });
    </script>
  </body>
</html>
```

Open it in a browser and click the button. The modal appears, reads the price
from the endpoint's `402` response, and walks the user through paying. (Pointing
at `api.example.com` won't actually settle — we build a real endpoint next.)

That's the entire client integration. Everything below is the *server* you're
charging for.

---

## Part 2 — A paid endpoint (5 minutes)

A paid endpoint follows the x402 contract:

1. **No `X-PAYMENT` header →** respond `402` with a challenge describing what you
   accept.
2. **Valid `X-PAYMENT` header →** verify + settle it with an x402 facilitator,
   do the work, and return `200` with an `X-PAYMENT-RESPONSE` header.

Here's the challenge half (the part the modal reads). Create `server.js`:

```js
import express from 'express';

const app = express();
app.use(express.json());

// Atomic USDC is 6-decimal: 10000 = $0.01.
const PRICE_ATOMIC = '10000';

function challenge(req) {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  return {
    x402Version: 2,
    error: 'X-PAYMENT header is required',
    resource: { url, description: 'Summarize text', mimeType: 'application/json' },
    accepts: [
      {
        scheme: 'exact',
        network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana mainnet
        amount: PRICE_ATOMIC,
        asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
        payTo: 'REPLACE_WITH_YOUR_SOLANA_ADDRESS',
        maxTimeoutSeconds: 60,
        extra: {
          name: 'USDC',
          decimals: 6,
          // The facilitator sponsor that pays the SOL network fee so the buyer
          // needs only USDC. Provided by your x402 facilitator.
          feePayer: 'REPLACE_WITH_FACILITATOR_FEE_PAYER',
        },
      },
    ],
  };
}

app.post('/paid/summarize', (req, res) => {
  const xPayment = req.get('X-PAYMENT');
  if (!xPayment) {
    return res.status(402).json(challenge(req));
  }

  // 1. Verify + settle `xPayment` with your x402 facilitator here.
  //    (See the x402 spec — facilitator /verify and /settle.)
  // 2. Do the actual work:
  const summary = `Summary of: ${String(req.body?.text || '').slice(0, 40)}…`;

  // 3. Return the result. Attach the base64 settlement as X-PAYMENT-RESPONSE.
  res.json({ summary });
});

app.listen(3000, () => console.log('http://localhost:3000'));
```

> Verifying and settling the `X-PAYMENT` payload against a facilitator is the
> server's responsibility and is beyond this modal's scope — see the
> [x402 spec](https://x402.org). The modal's job is everything on the client.

Point your button's `data-x402-endpoint` at `http://localhost:3000/paid/summarize`
and the modal will read your real price.

---

## Part 3 — The Solana checkout endpoint (5 minutes)

EVM payments are signed entirely in the browser, so if you only accept Base/EVM
USDC you can **stop here**. For Solana, Phantom can sign but not *build*
transactions, so the modal calls a small endpoint to build the transfer and wrap
the signed tx. The package ships it — mount it in the same server:

```bash
npm install @solana/web3.js @solana/spl-token
```

```js
import { x402CheckoutRouter } from '@three-ws/x402-payment-modal/server/express';

app.use(
  '/api/x402-checkout',
  x402CheckoutRouter({ rpcUrl: process.env.SOLANA_RPC_URL }),
);
```

The modal automatically POSTs to `/api/x402-checkout?action=prepare` and
`?action=encode` on the same origin as the script. If your checkout lives on a
different origin, tell the modal:

```js
import { configure } from '@three-ws/x402-payment-modal';
configure({ checkoutOrigin: 'https://pay.acme.com' });
```

Set a reliable RPC (a public endpoint is rate-limited):

```bash
SOLANA_RPC_URL="https://your-rpc-provider/..." node server.js
```

That's it — a full paid endpoint with a polished checkout.

---

## Where to go next

- **Brand the modal** → [docs/theming.md](docs/theming.md)
- **Let repeat buyers skip paying** → [docs/siwx.md](docs/siwx.md)
- **Cap how much a user can spend** → [docs/spending-caps.md](docs/spending-caps.md)
- **React / framework usage** → [examples/react/](examples/react/)
- **A runnable server** → [examples/server-express/](examples/server-express/)
- **The full lifecycle** → [docs/architecture.md](docs/architecture.md)
