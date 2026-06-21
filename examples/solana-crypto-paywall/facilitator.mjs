// Minimal x402 facilitator client — Solana `exact` scheme, USDC on mainnet.
//
// The browser modal signs the SPL transfer (Phantom) and posts it back as a
// base64 `X-PAYMENT` header. The merchant (this server) is responsible for the
// other half of the protocol: ask a facilitator to (1) /verify the signed
// payment matches what we offered, then (2) /settle it on-chain. PayAI's public
// facilitator co-signs as the fee payer and broadcasts — so the merchant never
// holds a private key and pays no gas.
//
// This is the same wire format the main three.ws app uses (api/_lib/x402-spec.js
// verifyPayment/settlePayment), trimmed to exactly what the Solana exact path
// needs so the example stays self-contained and easy to read:
//
//   POST {facilitator}/verify  { x402Version, paymentPayload, paymentRequirements }
//     → { isValid: boolean, invalidReason?, payer? }
//   POST {facilitator}/settle  { x402Version, paymentPayload, paymentRequirements }
//     → { success: boolean, transaction?, network?, payer?, errorReason? }
//
// No API key required for PayAI's public Solana lane. Override the URL with
// X402_FACILITATOR_URL if you run your own.

import { createHash } from 'node:crypto';

export const X402_VERSION = 2;

// PayAI supports Solana + Base mainnet with no auth token. The reference
// x402.org facilitator only settles base-sepolia, so it can't stand in here.
const FACILITATOR_URL = (process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network').replace(/\/+$/, '');
const FACILITATOR_TOKEN = process.env.X402_FACILITATOR_TOKEN || null;
const TIMEOUT_MS = 20_000;

/** Decode the base64-JSON `X-PAYMENT` header into a v2 PaymentPayload. */
export function decodePaymentHeader(header) {
	if (!header) {
		throw httpError(402, 'payment_required', 'X-PAYMENT header required');
	}
	let json;
	try {
		json = Buffer.from(String(header), 'base64').toString('utf8');
	} catch (err) {
		throw httpError(400, 'invalid_payment', `X-PAYMENT base64 decode failed: ${err.message}`);
	}
	let payload;
	try {
		payload = JSON.parse(json);
	} catch (err) {
		throw httpError(400, 'invalid_payment', `X-PAYMENT JSON parse failed: ${err.message}`);
	}
	if (!payload || typeof payload !== 'object') {
		throw httpError(400, 'invalid_payment', 'X-PAYMENT must decode to a JSON object');
	}
	return payload;
}

/**
 * Verify a decoded payment against the requirement we advertised.
 * Resolves to `{ payer }` when valid; throws a 402 when the facilitator
 * rejects it (so the modal can re-prompt the buyer to pay).
 */
export async function verifyPayment({ paymentPayload, requirement }) {
	const result = await callFacilitator('/verify', {
		x402Version: X402_VERSION,
		paymentPayload,
		paymentRequirements: requirement,
	});
	if (!result.isValid) {
		throw httpError(402, 'invalid_payment', `payment rejected: ${result.invalidReason || 'unknown reason'}`);
	}
	// Defense-in-depth: a buggy/compromised facilitator must not be able to
	// verify a payment for a different chain than the one we offered.
	if (result.network && result.network !== requirement.network) {
		throw httpError(502, 'facilitator_bad_response', `verify network mismatch: offered ${requirement.network}, got ${result.network}`);
	}
	return { payer: result.payer || null };
}

/**
 * Settle the verified payment on-chain via the facilitator. Carries a
 * deterministic Idempotency-Key so a retried settle (timeout / 5xx) is
 * de-duplicated by the facilitator instead of charging the buyer twice.
 */
export async function settlePayment({ paymentPayload, requirement }) {
	const idempotencyKey = buildIdempotencyKey({ paymentPayload, requirement });
	const result = await callFacilitator(
		'/settle',
		{ x402Version: X402_VERSION, paymentPayload, paymentRequirements: requirement },
		{ idempotencyKey },
	);
	if (!result.success) {
		throw httpError(502, 'settle_failed', `settlement failed: ${result.errorReason || 'unknown reason'}`);
	}
	return {
		transaction: result.transaction || null,
		network: result.network || requirement.network,
		payer: result.payer || null,
	};
}

/** Base64-JSON settlement receipt for the `X-PAYMENT-RESPONSE` header. */
export function encodePaymentResponse(settled) {
	return Buffer.from(
		JSON.stringify({
			success: true,
			transaction: settled.transaction,
			network: settled.network,
			payer: settled.payer,
		}),
		'utf8',
	).toString('base64');
}

// ── internals ───────────────────────────────────────────────────────────────

function buildIdempotencyKey({ paymentPayload, requirement }) {
	const material = JSON.stringify({
		network: requirement?.network,
		payTo: requirement?.payTo,
		asset: requirement?.asset,
		amount: requirement?.amount,
		scheme: requirement?.scheme,
		payload: paymentPayload,
	});
	return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

async function callFacilitator(path, body, { idempotencyKey } = {}) {
	const headers = { 'content-type': 'application/json', accept: 'application/json' };
	if (FACILITATOR_TOKEN) headers.Authorization = `Bearer ${FACILITATOR_TOKEN}`;
	if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

	let res;
	try {
		res = await fetch(`${FACILITATOR_URL}${path}`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch (err) {
		throw httpError(502, 'facilitator_unreachable', `facilitator ${path} fetch failed: ${err.message}`);
	}

	const text = await res.text();
	let data = {};
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			throw httpError(502, 'facilitator_bad_response', `facilitator ${path} returned non-JSON (status ${res.status})`);
		}
	}

	if (!res.ok) {
		// A rejected payment payload is a client problem, not an outage — normalize
		// it so verifyPayment can re-issue a clean 402 instead of a 5xx.
		if (path === '/verify' && (data.isValid === false || res.status === 400)) {
			return { isValid: false, invalidReason: data.invalidReason || data.error || `payment rejected (status ${res.status})` };
		}
		const detail = data.error || data.errorReason || data.message || text.slice(0, 200) || `status ${res.status}`;
		throw httpError(502, 'facilitator_error', `facilitator ${path} ${res.status}: ${detail}`);
	}
	return data;
}

function httpError(status, code, message) {
	const err = new Error(message);
	err.status = status;
	err.code = code;
	return err;
}
