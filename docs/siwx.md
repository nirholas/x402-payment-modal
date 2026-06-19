# SIWX — Sign-In-With-X re-entry

SIWX ("Sign-In-With-X", standardized as [CAIP-122](https://chainagnostic.org/CAIPs/caip-122))
lets a wallet that **already paid** for an endpoint get back in by **signing a
challenge instead of paying again**. It is the difference between a one-time
purchase and being charged on every page load.

This package implements the **client** side of SIWX. The server endpoint must
issue the challenge and verify the signed proof — see
[Server responsibilities](#server-responsibilities).

For the overall flow, see [architecture](./architecture.md).

## Why it matters

x402 charges per call. Without SIWX, a user who paid for `/premium` would pay
again the next time they hit it. With SIWX, the merchant can recognize a wallet
that has an active entitlement: the wallet proves ownership with a cheap,
gasless, off-chain signature, and the merchant grants access without a new
payment.

## How the server advertises SIWX

When the endpoint returns its **HTTP 402** challenge, it advertises SIWX support
by including an extension entry in the challenge body:

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "network": "base",
      "asset": "0xUSDC...synthetic",
      "maxAmountRequired": "50000",
      "payTo": "0xMerchant...synthetic",
      "extensions": {
        "sign-in-with-x": {
          "domain": "api.example.com",
          "statement": "Sign in to re-enter your paid session.",
          "nonce": "synthetic-nonce-abc123"
        }
      }
    }
  ]
}
```

The exact challenge fields are defined by the x402 SIWX spec; the modal only
needs `extensions['sign-in-with-x']` to be present to offer sign-in.

## How the client submits proof

When the user signs the challenge, the modal sends the signed CAIP-122 proof back
to the endpoint as a base64-encoded JSON value in the **`SIGN-IN-WITH-X`**
request header, then retries the original request. If the merchant accepts the
proof, it returns the result with no payment required.

## Modal behavior

The modal adapts its layout to what the challenge offers:

1. **SIWX advertised + a compatible wallet present** — the modal **leads with
   "Sign in with wallet"** as the primary (`.x402-pay-btn`) action and **demotes
   pay to secondary** (`.x402-pay-secondary`). Signing in is cheaper, so it's the
   default.
2. **User signs in** — on success the modal resolves [`PayResult`](./api-reference.md#payresult)
   with the `siwx` field populated (`{ address, network }`) and **no `payment`
   field**, and fires the [`x402:siwx-signed`](#the-x402siwx-signed-event) event.
3. **Sign-in rejected (`siwx_not_paid`)** — if the server answers the SIWX
   attempt with a `401`/`402` carrying a `siwx_not_paid` reason (the wallet has
   no active entitlement), the modal **falls back to the normal pay flow** and
   shows a notice explaining that payment is required.
4. **SIWX not advertised** — the modal behaves as a plain pay modal; nothing
   changes.

## The `x402:siwx-signed` event

A successful SIWX re-entry dispatches a bubbling `x402:siwx-signed`
`CustomEvent` on the clicked element:

```js
const btn = document.querySelector('[data-x402-endpoint]');

btn.addEventListener('x402:siwx-signed', (e) => {
  const { address, network } = e.detail;
  console.log(`re-entered as ${address} on ${network}`);
});
```

You also get the same data programmatically from the resolved result:

```js
const res = await pay({ endpoint: 'https://api.example.com/premium' });

if (res.siwx) {
  console.log('re-entered via SIWX:', res.siwx.address);
} else if (res.payment) {
  console.log('paid:', res.payment.transaction);
}
```

## Server responsibilities

This package does not store entitlements or verify signatures. Your endpoint
must:

1. **Advertise** the SIWX extension in the 402 challenge (see above).
2. **Verify** the CAIP-122 proof from the `SIGN-IN-WITH-X` header — check the
   nonce, domain, expiry, and signature against the claimed address.
3. **Authorize** the request if that address has an active paid entitlement;
   otherwise respond `401`/`402` with `siwx_not_paid` so the client falls back to
   paying.

Implement these against the x402 SIWX specification. The modal handles
everything on the browser side: detecting the offer, prompting the signature,
encoding the header, retrying, and falling back.
