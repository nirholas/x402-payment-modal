# Theming

The modal ships its own styles so it looks finished out of the box, then gives
you clean hooks to skin it to your brand. There is no build step and no CSS file
to import — styles are injected at runtime.

For the markup these classes wrap, see the step model in
[architecture](./architecture.md).

## How styles are injected

On first use, the modal injects a single `<style id="x402-styles">` block into
the document head. It is injected **once**; subsequent opens reuse it.

To override it, do one of:

1. Define your own rules with **higher specificity** in a stylesheet loaded
   **after** the module runs (so your rules win on equal specificity, or beat
   the injected ones).
2. Use `!important` on the specific declarations you want to force.
3. Override the exposed **CSS custom property** (`--x402-z`) where one exists.

The modal is **light by default** and includes a built-in dark theme via
`@media (prefers-color-scheme: dark)` — it follows the OS setting automatically.

## CSS classes

| Class                  | Element / role                                                      |
|------------------------|---------------------------------------------------------------------|
| `.x402-overlay`        | Root overlay. Holds `--x402-z` (z-index, default `2147483600`).      |
| `.x402-modal`          | The modal card container.                                           |
| `.x402-head`           | Header region (merchant/action/close).                             |
| `.x402-merchant`       | Merchant block in the header.                                       |
| `.x402-name`           | Merchant name text.                                                 |
| `.x402-action`         | Action label text (from `action`).                                 |
| `.x402-close`          | Close button.                                                       |
| `.x402-price-row`      | Row holding price + network.                                       |
| `.x402-price`          | Numeric price.                                                     |
| `.x402-currency`       | Currency label (e.g. USDC).                                        |
| `.x402-network`        | Network badge (e.g. Base / Solana).                               |
| `.x402-body`           | Main content area.                                                 |
| `.x402-step`           | A lifecycle step row. Modifiers below.                             |
| `.x402-step.x402-active` | The step currently in progress.                                 |
| `.x402-step.x402-done` | A completed step.                                                  |
| `.x402-step.x402-error`| A step that failed.                                               |
| `.x402-wallet-btn`     | A wallet choice button (Phantom / EVM).                           |
| `.x402-pay-btn`        | Primary pay / confirm button.                                     |
| `.x402-pay-secondary`  | Secondary action button (e.g. demoted pay under SIWX).            |
| `.x402-error-box`      | Error message container.                                          |
| `.x402-receipt`        | Settled-payment receipt block.                                    |
| `.x402-result`         | The paid endpoint's returned result.                             |
| `.x402-foot`           | Footer (brand attribution + footer note).                        |

The four `.x402-step` rows correspond to the discover / connect / authorize /
verify lifecycle described in [architecture](./architecture.md).

## Overriding the z-index

The overlay z-index is a custom property so you can lower it under your own
top-layer UI (or raise it) without touching the rest of the stylesheet:

```css
.x402-overlay {
  --x402-z: 9999;
}
```

Default is `2147483600` (just under the 32-bit max) so the modal sits above most
app chrome.

## Dark mode

Dark styling is automatic via `prefers-color-scheme: dark`. To force a single
theme regardless of OS, override the relevant classes. For example, to force the
light look everywhere:

```css
@media (prefers-color-scheme: dark) {
  .x402-modal { background: #ffffff; color: #111111; }
}
```

## Worked example: brand the pay button and modal radius

Load this **after** the module so it wins:

```html
<script type="module" src="https://unpkg.com/@three-ws/x402-payment-modal"></script>
<style>
  /* Rounder card */
  .x402-modal {
    border-radius: 18px;
  }

  /* Brand-colored primary button with a hover lift */
  .x402-pay-btn {
    background: #4f46e5;          /* indigo */
    color: #fff;
    border: none;
    transition: transform 120ms ease, background 120ms ease;
  }
  .x402-pay-btn:hover {
    background: #4338ca;
    transform: translateY(-1px);
  }
  .x402-pay-btn:active {
    transform: translateY(0);
  }
  .x402-pay-btn:focus-visible {
    outline: 2px solid #818cf8;
    outline-offset: 2px;
  }

  /* Tone down the secondary action */
  .x402-pay-secondary {
    background: transparent;
    color: #4f46e5;
  }
</style>
```

If a rule still loses to the injected stylesheet, raise specificity (e.g.
`.x402-overlay .x402-pay-btn`) or add `!important` to the individual
declarations.
