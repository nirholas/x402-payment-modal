/**
 * React example for @nirholas/x402-payment-modal.
 *
 * This uses the package's SHIPPED React wrapper — `@nirholas/x402-payment-modal/react`
 * — not a hand-rolled component. The wrapper exports:
 *
 *   - <X402Button>  a drop-in pay button
 *   - useX402()     a headless { pay, status, result, error, reset, isPaying } hook
 *
 * Both dynamically import the browser-only core on first use, so they are
 * SSR-safe (nothing runs during render or on the server) in Next.js, Remix, etc.
 *
 * For Solana payments your app must also run the checkout endpoint
 * (see ../../docs/server-setup.md and ../server-express). EVM payments sign
 * in-browser and need no server.
 *
 * The endpoints below are PLACEHOLDERS — swap in a real x402 endpoint.
 */

import { useState } from 'react';
import { X402Button, useX402 } from '@nirholas/x402-payment-modal/react';

export default function App() {
  return (
    <main style={{ maxWidth: 520, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>x402 Payment Modal — React</h1>

      <h2>1. Drop-in button</h2>
      <ButtonDemo />

      <h2>2. Headless hook</h2>
      <HookDemo />
    </main>
  );
}

/** The simplest integration: render <X402Button> and handle the result. */
function ButtonDemo() {
  const [last, setLast] = useState(null);

  return (
    <>
      <X402Button
        endpoint="https://api.example.com/paid/summarize"
        method="POST"
        body={{ url: 'https://en.wikipedia.org/wiki/x402' }}
        merchant="Acme Summaries"
        action="Summarize article"
        label="Summarize for $0.01"
        // Client-side cap (stablecoin only): 0.10 USDC per call.
        caps={{ maxPerCall: 100_000 }}
        onResult={(r) => setLast(r)}
        onError={(e) => console.error('payment failed', e)}
      />
      {last && (
        <pre style={{ marginTop: 12 }}>
          {JSON.stringify({ payment: last.payment, result: last.result }, null, 2)}
        </pre>
      )}
    </>
  );
}

/** Full control over the trigger UI via the useX402 state machine. */
function HookDemo() {
  const { pay, status, result, error, reset, isPaying } = useX402({
    merchant: 'Acme',
    action: 'Unlock premium',
  });

  if (status === 'done') {
    return (
      <>
        <pre>{JSON.stringify(result.result, null, 2)}</pre>
        <button onClick={reset}>Reset</button>
      </>
    );
  }

  return (
    <>
      <button
        disabled={isPaying}
        onClick={() => pay({ endpoint: 'https://api.example.com/paid/premium' })}
      >
        {isPaying ? 'Processing…' : 'Unlock for $0.05'}
      </button>
      {status === 'error' && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error?.message} <button onClick={reset}>Try again</button>
        </p>
      )}
    </>
  );
}
