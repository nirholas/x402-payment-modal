# React example

Uses the package's **shipped** React wrapper —
[`@nirholas/x402-payment-modal/react`](../../docs/react.md) — not a hand-rolled
component. You get `<X402Button>` (a drop-in button) and `useX402()` (a headless
hook), both SSR-safe.

## Install

```bash
npm i @nirholas/x402-payment-modal
```

`react` is an optional peer dependency you already have.

## Use it

[`App.jsx`](./App.jsx) shows both the button and the hook. The button form:

```jsx
import { X402Button } from '@nirholas/x402-payment-modal/react';

export default function Demo() {
  return (
    <X402Button
      endpoint="https://api.example.com/paid/summarize"
      method="POST"
      body={{ url: 'https://en.wikipedia.org/wiki/x402' }}
      merchant="Acme Summaries"
      action="Summarize article"
      label="Summarize for $0.01"
      caps={{ maxPerCall: 100_000 }}     // 0.10 USDC, stablecoin caps only
      onResult={(r) => console.log('paid', r.payment)}
      onError={(e) => console.error('payment failed', e)}
    />
  );
}
```

The headless form, for full control over the trigger UI:

```jsx
import { useX402 } from '@nirholas/x402-payment-modal/react';

function Buy() {
  const { pay, isPaying } = useX402({ merchant: 'Acme' });
  return (
    <button disabled={isPaying} onClick={() => pay({ endpoint: '/api/paid/premium' })}>
      {isPaying ? 'Processing…' : 'Pay'}
    </button>
  );
}
```

### `<X402Button>` props

See the [React reference](../../docs/react.md#x402button) for the full table.
`onResult` receives `{ ok, result, payment?, siwx?, response }`; `onError` is
**not** called when the user cancels.

## SSR safety

The wrapper dynamically imports the browser-only core on first payment, so nothing
from the package runs during render or on the server — safe in Next.js, Remix, and
Astro without a `dynamic`/`ssr:false` wrapper.

## Solana payments need a server

EVM payments sign in the browser (EIP-3009) and need no backend. **Solana payments
require a checkout endpoint** that builds and settles the transfer — see
[`../../docs/server-setup.md`](../../docs/server-setup.md) and the runnable
[`examples/server-express`](../server-express).
