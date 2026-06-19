/**
 * <X402Button> — a thin React wrapper around @three-ws/x402-payment-modal.
 *
 * The package is a browser-only ES module (it renders a modal and talks to a
 * wallet), so we dynamically import it INSIDE the click handler. That keeps the
 * component SSR-safe: nothing from the package is touched during render or on
 * the server.
 *
 * Usage:
 *
 *   import X402Button from './X402Button';
 *
 *   <X402Button
 *     endpoint="https://api.example.com/paid/summarize"
 *     method="POST"
 *     body={{ url: 'https://en.wikipedia.org/wiki/x402' }}
 *     merchant="Acme Summaries"
 *     action="Summarize article"
 *     label="Summarize for 0.01 USDC"
 *     onResult={(r) => console.log('paid', r)}
 *     onError={(e) => console.error(e)}
 *   />
 *
 * For Solana payments your app must also run the server checkout endpoint
 * (see ../../docs/server-setup.md and examples/server-express). EVM payments
 * sign in-browser and need no server.
 */

import { useCallback, useState } from 'react';

export default function X402Button({
  endpoint,
  method = 'GET',
  body,
  merchant,
  action,
  label = 'Pay',
  onResult,
  onError,
  children,
  ...rest
}) {
  const [processing, setProcessing] = useState(false);

  const handleClick = useCallback(async () => {
    if (processing) return;
    setProcessing(true);

    try {
      // Dynamic import keeps the browser-only module out of the SSR bundle.
      const { pay } = await import('@three-ws/x402-payment-modal');

      const result = await pay({
        endpoint,
        method,
        body,
        merchant,
        action,
      });

      // result = { ok, result, payment?, siwx?, response }
      onResult?.(result);
    } catch (err) {
      // The modal rejects with err.code === 'cancelled' when the user dismisses
      // it. That is not an error — stay silent so we don't flash a failure.
      if (err && err.code === 'cancelled') return;
      onError?.(err);
    } finally {
      setProcessing(false);
    }
  }, [processing, endpoint, method, body, merchant, action, onResult, onError]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={processing}
      aria-busy={processing}
      {...rest}
    >
      {processing ? 'Processing…' : children ?? label}
    </button>
  );
}
