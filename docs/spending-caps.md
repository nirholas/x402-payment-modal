# Spending caps

Spending caps are client-side guardrails that stop a wallet from spending more
than you allow through the modal — per call, per hour, and per day. They make
unattended or agentic usage safer by bounding the blast radius of a bug or a
runaway loop.

They are passed to [`pay()`](./api-reference.md#payopts) via the `caps` option.

## Shape

```ts
interface SpendingCaps {
  maxPerCall?: string | number;
  maxPerHour?: string | number;
  maxPerDay?:  string | number;
}
```

All amounts are **atomic micro-USD** — i.e. millionths of a dollar
(`1_000_000` = 1 USDC). Strings are accepted to avoid floating-point loss on
large numbers.

| Field        | Meaning                                                |
|--------------|--------------------------------------------------------|
| `maxPerCall` | Maximum a single payment may cost.                     |
| `maxPerHour` | Maximum total across the current UTC hour bucket.      |
| `maxPerDay`  | Maximum total across the current UTC day bucket.       |

## How enforcement works

- Spend is tracked in **`localStorage`, per wallet address.**
- Totals are **bucketed by UTC hour and UTC day**, so the windows roll over
  cleanly and survive a page reload.
- Before a payment is signed, the modal **reserves** the amount against the
  relevant buckets. If any cap would be exceeded, the payment is blocked and the
  user sees an error explaining which limit was hit.
- If the payment **fails or is cancelled**, the reservation is **rolled back** so
  a failed attempt never counts against the user's budget. (Cancellation is the
  `pay()` rejection with `.code === 'cancelled'`.)

## Important caveat: stablecoins only

The drop-in script stays **zero-dependency and does not fetch live prices.** That
means it can only reason about value when 1 token ≈ 1 USD — i.e. **stablecoins
(USDC / USDT / DAI).** For those, atomic micro-USD caps are meaningful directly.

For **non-stable assets**, the modal cannot convert an amount to USD without a
price feed, so browser caps do **not** meaningfully bound spend. **Enforce caps
for non-stable assets on the server side**, where you can price the asset at
settlement time.

## Not a security boundary

Client-side caps are **advisory guardrails, not a security control.** They live in
`localStorage`, which a determined user can clear or edit, and they only cover
flows that go through this modal. Treat them as a convenience and a safety net for
honest usage. **Real spending limits belong on the server**, enforced where the
payment is verified and settled.

## Worked example

```js
import { pay } from '@nirholas/x402-payment-modal';

// USDC, so atomic micro-USD caps apply directly:
//   0.10 USDC per call, 2.00 USDC/hour, 10.00 USDC/day
const res = await pay({
  endpoint: 'https://api.example.com/premium',
  method: 'POST',
  body: { prompt: 'Summarize this article' },
  merchant: 'Example API',
  action: 'Generate summary',
  caps: {
    maxPerCall: 100_000,      // 0.10 USDC
    maxPerHour: 2_000_000,    // 2.00 USDC
    maxPerDay:  10_000_000,   // 10.00 USDC
  },
});

console.log(res.result);
```

If a call would push the current UTC-hour total over `maxPerHour`, the modal
blocks it before any wallet prompt and surfaces the reason; nothing is reserved.

## See also

- [API reference](./api-reference.md) — where `caps` fits in `PayOptions`.
- [Architecture](./architecture.md) — where the reservation/rollback sits in the
  lifecycle.
- [Server setup](./server-setup.md) — for enforcing real limits server-side.
