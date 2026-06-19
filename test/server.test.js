// Server-side checkout tests — pure logic, no network required.
//
//   npm test    (from the package root)
//
// `prepareSolanaCheckout` validates its input *before* any RPC round-trip, so we
// can assert the validation paths without a live Solana connection. `encode` is
// fully offline.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	encodeX402Payment,
	prepareSolanaCheckout,
	handleCheckout,
	isSolanaNetwork,
	CheckoutError,
	NETWORK_SOLANA_MAINNET,
	NETWORK_SOLANA_DEVNET,
} from '../server/checkout.js';

const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// Clearly-synthetic placeholder addresses (valid base58, 32-44 chars).
const PAY_TO = '11111111111111111111111111111112';
const FEE_PAYER = 'So11111111111111111111111111111111111111112';
const BUYER = 'So11111111111111111111111111111111111111112';

function accept(overrides = {}) {
	return {
		scheme: 'exact',
		network: NETWORK_SOLANA_MAINNET,
		amount: '10000',
		asset: USDC_MAINNET,
		payTo: PAY_TO,
		extra: { name: 'USDC', decimals: 6, feePayer: FEE_PAYER },
		...overrides,
	};
}

test('isSolanaNetwork recognizes the CAIP-2 ids and the bare alias', () => {
	assert.ok(isSolanaNetwork(NETWORK_SOLANA_MAINNET));
	assert.ok(isSolanaNetwork(NETWORK_SOLANA_DEVNET));
	assert.ok(isSolanaNetwork('solana'));
	assert.ok(!isSolanaNetwork('eip155:8453'));
});

test('encodeX402Payment produces a decodable v2 envelope', () => {
	const { x_payment } = encodeX402Payment({
		accept: accept(),
		signedTxBase64: 'A'.repeat(80),
		resourceUrl: 'https://example.com/api/paid',
	});
	const decoded = JSON.parse(Buffer.from(x_payment, 'base64').toString('utf8'));
	assert.equal(decoded.x402Version, 2);
	assert.equal(decoded.scheme, 'exact');
	assert.equal(decoded.network, NETWORK_SOLANA_MAINNET);
	assert.equal(decoded.resource.url, 'https://example.com/api/paid');
	assert.equal(decoded.payload.transaction, 'A'.repeat(80));
	assert.equal(decoded.extensions, undefined);
});

test('encodeX402Payment echoes a valid builder-code and drops a bad one', () => {
	const good = encodeX402Payment({
		accept: accept(),
		signedTxBase64: 'A'.repeat(80),
		resourceUrl: 'https://example.com/api/paid',
		builderCode: { a: 'agentic', w: 'acme', s: ['acme_checkout', 'BAD CODE!'] },
	});
	const decoded = JSON.parse(Buffer.from(good.x_payment, 'base64').toString('utf8'));
	assert.deepEqual(decoded.extensions['builder-code'], { a: 'agentic', w: 'acme', s: ['acme_checkout'] });

	const noA = encodeX402Payment({
		accept: accept(),
		signedTxBase64: 'A'.repeat(80),
		resourceUrl: 'https://example.com/api/paid',
		builderCode: { w: 'acme' }, // missing required `a`
	});
	const decodedNoA = JSON.parse(Buffer.from(noA.x_payment, 'base64').toString('utf8'));
	assert.equal(decodedNoA.extensions, undefined);
});

test('encodeX402Payment rejects a relative resource url', () => {
	assert.throws(
		() => encodeX402Payment({ accept: accept(), signedTxBase64: 'A'.repeat(80), resourceUrl: '/relative' }),
		(e) => e instanceof CheckoutError && e.status === 400,
	);
});

test('prepareSolanaCheckout rejects an EVM network before any RPC call', async () => {
	await assert.rejects(
		prepareSolanaCheckout({ accept: accept({ network: 'eip155:8453' }), buyer: BUYER }),
		(e) => e instanceof CheckoutError && e.code === 'unsupported_network',
	);
});

test('prepareSolanaCheckout rejects a bad buyer address before any RPC call', async () => {
	await assert.rejects(
		prepareSolanaCheckout({ accept: accept(), buyer: 'not-a-pubkey' }),
		(e) => e instanceof CheckoutError && e.code === 'invalid_request',
	);
});

test('prepareSolanaCheckout requires a fee payer', async () => {
	await assert.rejects(
		prepareSolanaCheckout({ accept: accept({ extra: { name: 'USDC', decimals: 6 } }), buyer: BUYER }),
		(e) => e instanceof CheckoutError && e.code === 'invalid_request',
	);
});

test('handleCheckout routes encode and returns 200', async () => {
	const res = await handleCheckout({
		action: 'encode',
		body: {
			accept: accept(),
			signed_tx_base64: 'A'.repeat(80),
			resource_url: 'https://example.com/api/paid',
		},
	});
	assert.equal(res.status, 200);
	assert.ok(typeof res.body.x_payment === 'string');
});

test('handleCheckout 404s an unknown action', async () => {
	const res = await handleCheckout({ action: 'bogus', body: {} });
	assert.equal(res.status, 404);
	assert.equal(res.body.error, 'not_found');
});

test('handleCheckout maps a CheckoutError to its status', async () => {
	const res = await handleCheckout({
		action: 'prepare',
		body: { accept: accept({ network: 'eip155:8453' }), buyer: BUYER },
	});
	assert.equal(res.status, 400);
	assert.equal(res.body.error, 'unsupported_network');
});
