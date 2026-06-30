// @nirholas/x402-payment-modal/react — first-class React bindings.
//
//   import { X402Button, useX402 } from '@nirholas/x402-payment-modal/react';
//
// The core package is a browser-only ES module (it renders a modal and talks to
// a wallet), so it is dynamically imported on first use — nothing from it runs
// during render or on the server, keeping this SSR-safe. `react` is an optional
// peer dependency; this file uses `createElement` so it needs no JSX build step.

import { createElement, useCallback, useRef, useState } from 'react';

let _modPromise;
function loadCore() {
	if (!_modPromise) _modPromise = import('@nirholas/x402-payment-modal');
	return _modPromise;
}

/**
 * Configure the modal (checkout origin, theme, branding, …) before the first
 * payment. Resolves once the core module has loaded and applied the config.
 */
export function configure(opts) {
	return loadCore().then((m) => m.configure(opts));
}

/**
 * Headless-ish payment hook with a small state machine.
 * @param {object} [defaults] PayOptions merged under every pay() call.
 * @returns {{ pay: Function, status: string, result: any, error: Error|null, reset: Function, isPaying: boolean }}
 */
export function useX402(defaults = {}) {
	const [status, setStatus] = useState('idle'); // idle | paying | done | error
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);
	const inflight = useRef(false);
	// Keep the latest defaults without making pay() identity churn every render.
	const defaultsRef = useRef(defaults);
	defaultsRef.current = defaults;

	const pay = useCallback(async (opts = {}) => {
		if (inflight.current) return undefined;
		inflight.current = true;
		setStatus('paying');
		setError(null);
		setResult(null);
		try {
			const m = await loadCore();
			const res = await m.pay({ ...defaultsRef.current, ...opts });
			setResult(res);
			setStatus('done');
			return res;
		} catch (err) {
			// User dismissed the modal — not an error; return to idle quietly.
			if (err && err.code === 'cancelled') {
				setStatus('idle');
				return undefined;
			}
			setError(err);
			setStatus('error');
			throw err;
		} finally {
			inflight.current = false;
		}
	}, []);

	const reset = useCallback(() => {
		setStatus('idle');
		setResult(null);
		setError(null);
	}, []);

	return { pay, status, result, error, reset, isPaying: status === 'paying' };
}

/**
 * Drop-in pay button. Passes its payment props to `pay()`; calls `onResult` on
 * success and `onError` on failure (cancellation is silent).
 */
export function X402Button({
	endpoint,
	method,
	body,
	merchant,
	action,
	caps,
	headers,
	autoConnect,
	label = 'Pay',
	onResult,
	onError,
	children,
	...rest
}) {
	const { pay, isPaying } = useX402();

	const handleClick = useCallback(async () => {
		try {
			const res = await pay({ endpoint, method, body, merchant, action, caps, headers, autoConnect });
			if (res) onResult?.(res);
		} catch (err) {
			onError?.(err);
		}
	}, [pay, endpoint, method, body, merchant, action, caps, headers, autoConnect, onResult, onError]);

	return createElement(
		'button',
		{ type: 'button', onClick: handleClick, disabled: isPaying, 'aria-busy': isPaying, ...rest },
		isPaying ? 'Processing…' : (children ?? label),
	);
}

export default X402Button;
