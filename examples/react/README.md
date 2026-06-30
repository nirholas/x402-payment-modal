# React example — `<X402Button>`

A drop-in React component that wraps `pay()` from
[`@nirholas/x402-payment-modal`](https://www.npmjs.com/package/@nirholas/x402-payment-modal).

## Install

```bash
npm i @nirholas/x402-payment-modal
```

## Use it

Copy [`X402Button.jsx`](./X402Button.jsx) into your project, then:

```jsx
import X402Button from './X402Button';

export default function Demo() {
  return (
    <X402Button
      endpoint="https://api.example.com/paid/summarize"
      method="POST"
      body={{ url: 'https://en.wikipedia.org/wiki/x402' }}
      merchant="Acme Summaries"
      action="Summarize article"
      label="Summarize for 0.01 USDC"
      onResult={(r) => console.log('paid', r.payment)}
      onError={(e) => console.error('payment failed', e)}
    />
  );
}
```

### Props

| Prop       | Type       | Notes                                                       |
| ---------- | ---------- | ---------------------------------------------------------- |
| `endpoint` | `string`   | Required. The x402-enabled HTTP endpoint to call.          |
| `method`   | `string`   | HTTP method (default `GET`).                               |
| `body`     | `object`   | Request body (sent as JSON).                               |
| `merchant` | `string`   | Display name shown in the modal.                           |
| `action`   | `string`   | Short description of what the user is paying for.          |
| `label`    | `string`   | Button text (default `Pay`). `children` overrides it.      |
| `onResult` | `function` | Called with the `PayResult` on success.                    |
| `onError`  | `function` | Called on failure. **Not** called when the user cancels.   |

`onResult` receives `{ ok, result, payment?, siwx?, response }`.

## SSR safety

The package is browser-only (it renders a modal and connects to a wallet), so
`X402Button` imports it lazily **inside the click handler**:

```js
const { pay } = await import('@nirholas/x402-payment-modal');
```

Nothing from the package runs during render or on the server, so the component
is safe in Next.js, Remix, and other SSR frameworks without `dynamic`/`ssr:false`
wrappers.

## Solana payments need a server

EVM payments sign in the browser (EIP-3009) and need no backend. **Solana
payments require a checkout endpoint** that builds and settles the transfer.
Stand one up before going live — see
[`../../docs/server-setup.md`](../../docs/server-setup.md) and the runnable
[`examples/server-express`](../server-express) server.
