# React reference

The `./react` subpath ships first-class React bindings for the modal:

```js
import { X402Button, useX402, configure } from '@nirholas/x402-payment-modal/react';
```

`react` is an **optional peer dependency** — you already have it in a React app.
The browser-only core (`@nirholas/x402-payment-modal`) is **dynamically imported
on first use**, so nothing from it runs during render or on the server. That makes
both exports **SSR-safe** in Next.js, Remix, Astro, etc. — no `dynamic`/`ssr:false`
wrapper needed.

For the underlying `pay()` contract and `PayResult` shape, see the
[API reference](./api-reference.md). For the payment lifecycle, see
[architecture](./architecture.md).

---

## `<X402Button>`

A drop-in pay button. It renders a `<button>`, runs the modal on click, and calls
`onResult` / `onError`. While a payment is in flight it is `disabled`, shows
`Processing…`, and sets `aria-busy`. User cancellation is silent (no `onError`).

```jsx
import { X402Button } from '@nirholas/x402-payment-modal/react';

export default function Buy() {
  return (
    <X402Button
      endpoint="/api/paid/summarize"
      method="POST"
      body={{ url: 'https://en.wikipedia.org/wiki/x402' }}
      merchant="Acme Summaries"
      action="Summarize article"
      label="Summarize for $0.01"
      caps={{ maxPerCall: 100_000 }}     // 0.10 USDC (atomic micro-USD)
      onResult={(r) => console.log('paid', r.payment)}
      onError={(e) => console.error('payment failed', e)}
      className="my-pay-btn"             // extra props spread onto the <button>
    />
  );
}
```

### Props

| Prop          | Type                          | Notes                                                                       |
|---------------|-------------------------------|-----------------------------------------------------------------------------|
| `endpoint`    | `string`                      | **Required.** The x402-protected URL.                                       |
| `method`      | `string`                      | HTTP method. Defaults to `GET` (or `POST` when `body` is set).              |
| `body`        | `unknown`                     | Request body. Objects are JSON-stringified.                                 |
| `headers`     | `Record<string,string>`       | Extra request headers.                                                      |
| `merchant`    | `string`                      | Shown in the modal header.                                                  |
| `action`      | `string`                      | Shown in the modal header.                                                  |
| `caps`        | `SpendingCaps`                | Client-side caps (stablecoin only). See [spending caps](./spending-caps.md).|
| `autoConnect` | `boolean`                     | Skip the picker when exactly one wallet is detected.                        |
| `label`       | `string`                      | Button text. Default `"Pay"`. `children` overrides it.                      |
| `onResult`    | `(result: PayResult) => void` | Called on success.                                                          |
| `onError`     | `(error: Error) => void`      | Called on failure. **Not** called when the user cancels.                    |
| `children`    | `ReactNode`                   | Custom button content (overrides `label`).                                  |
| …`rest`       | `button` attributes           | Any other `<button>` prop (`className`, `style`, `id`, …) is spread through.|

`onResult` receives the full [`PayResult`](./api-reference.md#payresult):
`{ ok, result, payment?, siwx?, response }`.

---

## `useX402(defaults?)`

A headless payment hook with a small state machine. Use it when you want full
control over the trigger UI (your own button, a menu item, an effect) instead of
`<X402Button>`.

```jsx
import { useX402 } from '@nirholas/x402-payment-modal/react';

function PremiumGate() {
  const { pay, status, result, error, reset, isPaying } = useX402({
    merchant: 'Acme',          // defaults merged under every pay() call
    action: 'Unlock premium',
  });

  if (status === 'done') {
    return <pre>{JSON.stringify(result.result, null, 2)}</pre>;
  }

  return (
    <>
      <button disabled={isPaying} onClick={() => pay({ endpoint: '/api/paid/premium' })}>
        {isPaying ? 'Processing…' : 'Unlock for $0.05'}
      </button>
      {status === 'error' && (
        <p role="alert">
          {error?.message} <button onClick={reset}>Try again</button>
        </p>
      )}
    </>
  );
}
```

### Return value

| Field      | Type                                              | Notes                                                            |
|------------|---------------------------------------------------|------------------------------------------------------------------|
| `pay`      | `(opts?: Partial<PayOptions>) => Promise<PayResult \| undefined>` | Opens the modal; `opts` are merged over `defaults`. Resolves to the result, or `undefined` if cancelled. Re-entrancy is guarded — a second call while one is in flight is a no-op. |
| `status`   | `'idle' \| 'paying' \| 'done' \| 'error'`         | Current state. Cancellation returns to `idle`.                  |
| `result`   | `PayResult \| null`                               | The last successful result.                                     |
| `error`    | `Error \| null`                                   | The last non-cancellation error.                                |
| `reset`    | `() => void`                                       | Clear `result`/`error` back to `idle`.                          |
| `isPaying` | `boolean`                                          | `status === 'paying'`.                                          |

`pay` re-throws non-cancellation errors so you can `try/catch` at the call site as
well as read `error`.

---

## `configure(opts?)`

Set modal-wide config (checkout origin, theme, branding, builder-code, CDN URLs)
before the first payment. The React wrapper's `configure` is **async** — it
resolves once the core module has loaded and applied the config — so call it once
at app startup:

```jsx
import { useEffect } from 'react';
import { configure } from '@nirholas/x402-payment-modal/react';

export default function App({ children }) {
  useEffect(() => {
    configure({
      checkoutOrigin: 'https://pay.acme.com',
      theme: 'dark',
      brand: { name: 'Acme', url: 'https://acme.com', logo: '/logo.svg' },
    });
  }, []);
  return children;
}
```

The accepted options are identical to the core
[`configure()`](./api-reference.md#configure).

---

## SSR notes

- Import from `@nirholas/x402-payment-modal/react` anywhere — the heavy core is
  only loaded inside `pay()` / the button's click handler.
- The first payment pays a one-time dynamic-import cost; subsequent ones reuse the
  loaded module.
- `configure()` here returns a `Promise`; awaiting it (or firing it in an effect)
  guarantees the config is applied before the first modal opens.

## Solana payments still need a server

EVM signs in the browser; **Solana needs the checkout endpoint** that builds and
wraps the transfer. Stand one up before going live — see
[server setup](./server-setup.md) and the runnable
[`examples/server-express`](../examples/server-express).
