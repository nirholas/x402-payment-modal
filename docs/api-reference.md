# Client API reference

The browser entry point. Import it as an ES module, or drop the bundle on a page
and use `window.X402`. For how these pieces fit together see
[architecture](./architecture.md); for the Solana backend see
[server setup](./server-setup.md); for the React bindings see the
[React reference](./react.md).

```js
import { pay, configure, init, version } from '@nirholas/x402-payment-modal';
```

When loaded as a script, the same functions are available as
`window.X402.{ pay, init, configure, version }`. The module also auto-binds
`[data-x402-endpoint]` elements on load (and re-binds new ones via a
`MutationObserver`).

```html
<script type="module" src="https://unpkg.com/@nirholas/x402-payment-modal"></script>
```

---

## `pay(opts) => Promise<PayResult>`

Opens the modal and drives the full pay flow against one endpoint. Resolves once
the merchant settles and returns a result. Rejects with an `Error` whose
`.code === 'cancelled'` if the user closes the modal.

```js
try {
  const res = await pay({
    endpoint: 'https://api.example.com/premium',
    method: 'POST',
    body: { prompt: 'Summarize this article' },
    merchant: 'Example API',
    action: 'Generate summary',
    autoConnect: true,
  });
  console.log(res.result);        // the paid endpoint's response
  console.log(res.payment);       // { network, transaction, payer }
} catch (err) {
  if (err.code === 'cancelled') return;   // user closed the modal
  throw err;
}
```

### PayOptions

| Field         | Type                      | Required | Description                                                                 |
|---------------|---------------------------|----------|-----------------------------------------------------------------------------|
| `endpoint`    | `string`                  | yes      | The x402-protected URL to call.                                             |
| `method`      | `string`                  | no       | HTTP method. Defaults to `GET` (or `POST` when a `body` is supplied).       |
| `body`        | `object \| string`        | no       | Request body. An object is JSON-stringified; a string is sent as-is.        |
| `headers`     | `object`                  | no       | Extra request headers merged into both the probe and retry requests.       |
| `merchant`    | `string`                  | no       | Merchant name shown in the modal header.                                    |
| `action`      | `string`                  | no       | Short action label shown in the modal header (e.g. "Generate summary").     |
| `autoConnect` | `boolean`                 | no       | Skip the wallet picker when exactly one wallet is detected.                 |
| `caps`        | [`SpendingCaps`](./spending-caps.md) | no | Client-side spending limits, atomic micro-USD.                          |

### PayResult

```ts
{
  ok: true,
  result: unknown,          // parsed JSON, or text, from the paid endpoint
  payment?: {
    network: string,
    transaction: string,    // tx hash / signature
    payer: string,          // payer address
  },
  siwx?: {                  // present when re-entry used Sign-In-With-X
    address: string,
    network: string,
  },
  response: {
    status: number,
    headers: Record<string, string>,
  },
}
```

---

## `configure(opts) => Config`

Sets global defaults. All fields are optional; nested objects are
**shallow-merged** into the current config. Returns the resulting config.

```js
import { configure } from '@nirholas/x402-payment-modal';

configure({
  checkoutOrigin: 'https://pay.example.com',
  checkoutPath: '/api/x402-checkout',
  brand: { name: 'Example', url: 'https://example.com', logo: '/logo.svg' },
  footerNote: 'Secured by x402',
  theme: 'auto',                                  // 'auto' | 'light' | 'dark'
  cssVars: { '--x402-accent': '#ff5c00' },        // runtime brand-match
  builderCode: { wallet: 'examplewallet', service: 'example_api' },
  esm: {
    solanaWeb3: 'https://esm.sh/@solana/web3.js@1.95.0',
    nobleHashesSha3: 'https://esm.sh/@noble/hashes@1/sha3',
  },
});
```

| Field            | Type                                  | Description                                                                                   |
|------------------|---------------------------------------|-----------------------------------------------------------------------------------------------|
| `checkoutOrigin` | `string \| null`                      | Origin serving the Solana checkout endpoint. `null` resolves it from the script `src` or page origin. |
| `checkoutPath`   | `string`                              | Checkout path. Default `'/api/x402-checkout'`.                                                |
| `brand`          | `{ name?, url?, logo? }`              | Footer attribution (`name`/`url`) and an optional header `logo` (URL).                         |
| `footerNote`     | `string`                              | Text on the left side of the footer. Default `'x402 · onchain settled'`.                       |
| `theme`          | `'auto' \| 'light' \| 'dark'`         | Force the color scheme. Default `'auto'` (follow the OS). See [theming](./theming.md).        |
| `cssVars`        | `Record<string,string> \| null`       | Flat map of `--x402-*` design tokens to brand-match at runtime, e.g. `{ '--x402-radius': '8px' }`. |
| `builderCode`    | `{ wallet, service }`                 | ERC-8021 builder-code echo. Each value lowercase `[a-z0-9_]{1,32}`.                            |
| `esm`            | `{ solanaWeb3, nobleHashesSha3 }`     | CDN URLs for crypto helpers loaded on demand. Repoint for strict CSP / self-hosting.          |

Nested objects (`brand`, `builderCode`, `esm`, `cssVars`) are **shallow-merged**,
so you can set a single field without clearing the others.

> The `checkoutOrigin` / `checkoutPath` settings only matter for the Solana rail.
> EVM-only sites can ignore them.

---

## `init()`

Re-scans the document and binds every `[data-x402-endpoint]` element. This is
called automatically on load and whenever the `MutationObserver` sees new
matching elements, so you rarely need it — call it after injecting markup into a
context the observer doesn't cover (e.g. inside a shadow root you control).

```js
import { init } from '@nirholas/x402-payment-modal';
init();
```

---

## `version`

The package version string.

```js
import { version } from '@nirholas/x402-payment-modal';
console.log(version); // e.g. "1.2.0"
```

---

## Token constants

For inline merchants composing a 402 challenge in the browser, the client also
exports the well-known Solana mints (also at `window.X402.tokens`):

```js
import { USDC_MINT_SOLANA, THREE_MINT, KNOWN_SOLANA_TOKENS }
  from '@nirholas/x402-payment-modal';
```

| Export | Type | Notes |
|--------|------|-------|
| `USDC_MINT_SOLANA` | `string` | Solana USDC mint (mainnet) — the always-on default settlement asset. |
| `THREE_MINT` | `string` | An optional opt-in SPL token recognized by the modal; used only when an endpoint chooses to accept it alongside USDC. |
| `KNOWN_SOLANA_TOKENS` | `Readonly<Record<string, { symbol, name, decimals, stable?, accent?, glyph? }>>` | Mints the modal renders with the correct symbol/decimals even when the `accept` omits `extra.name`/`extra.decimals`. |

The server side builds accepts with the higher-level `solanaAccept()` helper — see
[server setup](./server-setup.md).

## HTML data attributes

You can drive the modal declaratively without writing JavaScript. Add attributes
to any clickable element and the auto-binder wires the click handler.

### On a clickable element

| Attribute              | Maps to            | Notes                          |
|------------------------|--------------------|--------------------------------|
| `data-x402-endpoint`   | `endpoint`         | **Required.**                  |
| `data-x402-method`     | `method`           |                                |
| `data-x402-body`       | `body`             | JSON string.                   |
| `data-x402-headers`    | `headers`          | JSON string.                   |
| `data-x402-merchant`   | `merchant`         |                                |
| `data-x402-action`     | `action`           |                                |

```html
<button
  data-x402-endpoint="https://api.example.com/premium"
  data-x402-method="POST"
  data-x402-body='{"prompt":"Summarize this article"}'
  data-x402-headers='{"X-Client":"web"}'
  data-x402-merchant="Example API"
  data-x402-action="Generate summary">
  Unlock for 0.05 USDC
</button>
```

### On the `<script>` tag (read once at load)

These configure global defaults from the script element that loads the module —
equivalent to calling `configure()`.

| Attribute                     | Maps to                  |
|-------------------------------|--------------------------|
| `data-x402-checkout-origin`   | `checkoutOrigin`         |
| `data-x402-checkout-path`     | `checkoutPath`           |
| `data-x402-footer-note`       | `footerNote`             |
| `data-x402-brand-name`        | `brand.name`             |
| `data-x402-brand-url`         | `brand.url`              |
| `data-x402-builder-wallet`    | `builderCode.wallet`     |
| `data-x402-builder-service`   | `builderCode.service`    |

```html
<script
  type="module"
  src="https://unpkg.com/@nirholas/x402-payment-modal"
  data-x402-checkout-origin="https://pay.example.com"
  data-x402-checkout-path="/api/x402-checkout"
  data-x402-brand-name="Example"
  data-x402-brand-url="https://example.com"
  data-x402-footer-note="Secured by x402"
  data-x402-builder-wallet="examplewallet"
  data-x402-builder-service="example_api"></script>
```

---

## DOM events

The modal dispatches bubbling `CustomEvent`s on the **clicked element** — useful
for declarative integrations where you never called `pay()` directly.

| Event              | `detail`                              | When                                  |
|--------------------|---------------------------------------|---------------------------------------|
| `x402:result`      | the [`PayResult`](#payresult)         | Payment settled and result returned.  |
| `x402:error`       | `{ error: string }`                   | The flow failed (not on cancellation).|
| `x402:siwx-signed` | `{ address, network }`                | A [SIWX](./siwx.md) sign-in succeeded.|

```js
const btn = document.querySelector('[data-x402-endpoint]');

btn.addEventListener('x402:result', (e) => {
  console.log('paid result:', e.detail.result);
});

btn.addEventListener('x402:error', (e) => {
  console.error('payment failed:', e.detail.error);
});

btn.addEventListener('x402:siwx-signed', (e) => {
  console.log('re-entered via SIWX:', e.detail.address, e.detail.network);
});
```
