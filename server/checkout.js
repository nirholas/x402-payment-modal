// @three-ws/x402-payment-modal/server — Solana checkout helpers.
//
// The modal's EVM path signs EIP-3009 typed-data entirely in the browser and
// never calls your server. The Solana path is different: Phantom only *signs*
// serialized transactions — it does not build instructions. So the modal needs a
// tiny server endpoint that (a) builds the SPL transfer the buyer should sign,
// and (b) wraps the signed transaction into the base64 `X-PAYMENT` envelope the
// x402 facilitator expects.
//
// This module is framework-agnostic. `prepareSolanaCheckout` and
// `encodeX402Payment` are pure functions; `handleCheckout` routes the two
// actions and returns `{ status, body }`. Thin adapters for Express and Vercel
// live in ./express.js and ./vercel.js.
//
// Runtime deps: @solana/web3.js and @solana/spl-token (declared as optional peer
// dependencies — install them in the app that mounts this handler). Nothing here
// imports anything three.ws-specific.

import {
	Connection,
	PublicKey,
	TransactionMessage,
	VersionedTransaction,
	ComputeBudgetProgram,
} from '@solana/web3.js';
import {
	TOKEN_PROGRAM_ID,
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAssociatedTokenAddressSync,
	createAssociatedTokenAccountIdempotentInstruction,
	createTransferCheckedInstruction,
	getMint,
} from '@solana/spl-token';

export const X402_VERSION = 2;

// CAIP-2 network identifiers for Solana (genesis-hash prefixes).
export const NETWORK_SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const NETWORK_SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

const DEFAULT_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

// Short-lived caches so repeated prepare calls don't re-issue identical RPC
// round-trips. Mint decimals are effectively immutable; a Solana blockhash stays
// valid for ~60-90s, so a few seconds of reuse cuts redundant traffic without
// handing out a blockhash too stale for the buyer's signed tx to land.
const MINT_DECIMALS_TTL_MS = 5 * 60 * 1000;
const BLOCKHASH_TTL_MS = 8 * 1000;
const mintDecimalsCache = new Map(); // `${rpc}:${mint}` -> { decimals, at }
const blockhashCache = new Map(); // rpc -> { blockhash, at }

/** Thrown for any client-correctable problem; carries an HTTP `status` + `code`. */
export class CheckoutError extends Error {
	constructor(status, code, message) {
		super(message);
		this.name = 'CheckoutError';
		this.status = status;
		this.code = code;
	}
}

export function isSolanaNetwork(network) {
	return (
		network === NETWORK_SOLANA_MAINNET ||
		network === NETWORK_SOLANA_DEVNET ||
		network === 'solana'
	);
}

function rpcFor(network, { rpcUrl, devnetRpcUrl } = {}) {
	if (network === NETWORK_SOLANA_DEVNET) return devnetRpcUrl || DEFAULT_DEVNET_RPC;
	return rpcUrl || DEFAULT_MAINNET_RPC;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function assertPubkey(value, field) {
	if (typeof value !== 'string' || !BASE58.test(value)) {
		throw new CheckoutError(400, 'invalid_request', `${field} must be a base58 Solana address`);
	}
	return value;
}

// Validate the subset of the x402 `accept` entry the Solana path relies on.
// `extra.feePayer` is required — it is the facilitator's sponsor account that
// pays the SOL network fee so the buyer needs no SOL, only USDC.
function validateAccept(accept) {
	if (!accept || typeof accept !== 'object') {
		throw new CheckoutError(400, 'invalid_request', 'accept object is required');
	}
	if (accept.scheme !== 'exact') {
		throw new CheckoutError(400, 'invalid_request', `unsupported scheme: ${accept.scheme}`);
	}
	if (!isSolanaNetwork(accept.network)) {
		throw new CheckoutError(
			400,
			'unsupported_network',
			`prepare only builds Solana transactions; got network=${accept.network}. EVM clients sign EIP-712 typed data locally and don't need this endpoint.`,
		);
	}
	if (typeof accept.amount !== 'string' || !/^\d+$/.test(accept.amount)) {
		throw new CheckoutError(400, 'invalid_request', 'accept.amount must be an atomic integer string');
	}
	assertPubkey(accept.asset, 'accept.asset');
	assertPubkey(accept.payTo, 'accept.payTo');
	const feePayer = accept.extra?.feePayer;
	assertPubkey(feePayer, 'accept.extra.feePayer');
	return accept;
}

async function getMintDecimals(conn, rpc, mint) {
	const key = `${rpc}:${mint.toBase58()}`;
	const hit = mintDecimalsCache.get(key);
	if (hit && Date.now() - hit.at < MINT_DECIMALS_TTL_MS) return hit.decimals;
	const info = await getMint(conn, mint);
	mintDecimalsCache.set(key, { decimals: info.decimals, at: Date.now() });
	return info.decimals;
}

async function getRecentBlockhash(conn, rpc) {
	const hit = blockhashCache.get(rpc);
	if (hit && Date.now() - hit.at < BLOCKHASH_TTL_MS) return hit.blockhash;
	const { blockhash } = await conn.getLatestBlockhash('confirmed');
	blockhashCache.set(rpc, { blockhash, at: Date.now() });
	return blockhash;
}

/**
 * Build the partially-signed v0 SPL `transferChecked` the buyer's Phantom wallet
 * should add its signature to. The fee payer is `accept.extra.feePayer` (the
 * facilitator's sponsor), so the buyer pays only USDC.
 *
 * @param {object} args
 * @param {object} args.accept   one x402 `accept` entry (scheme=exact, Solana)
 * @param {string} args.buyer    buyer's base58 Solana address
 * @param {string} [args.rpcUrl] mainnet RPC URL override
 * @param {string} [args.devnetRpcUrl] devnet RPC URL override
 * @returns {Promise<{ network: string, tx_base64: string, recent_blockhash: string }>}
 */
export async function prepareSolanaCheckout({ accept, buyer, rpcUrl, devnetRpcUrl }) {
	validateAccept(accept);
	assertPubkey(buyer, 'buyer');

	const rpc = rpcFor(accept.network, { rpcUrl, devnetRpcUrl });
	const conn = new Connection(rpc, 'confirmed');

	const mint = new PublicKey(accept.asset);
	const payTo = new PublicKey(accept.payTo);
	const feePayer = new PublicKey(accept.extra.feePayer);
	const buyerPubkey = new PublicKey(buyer);
	const amount = BigInt(accept.amount);

	const senderAta = getAssociatedTokenAddressSync(
		mint, buyerPubkey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
	);
	const receiverAta = getAssociatedTokenAddressSync(
		mint, payTo, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
	);
	const mintDecimals = await getMintDecimals(conn, rpc, mint);

	const ixs = [
		ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }),
		ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
	];
	// Create the recipient's token account if it doesn't exist yet — idempotent,
	// paid for by the fee payer so the buyer is never charged extra SOL.
	const receiverInfo = await conn.getAccountInfo(receiverAta);
	if (!receiverInfo) {
		ixs.push(
			createAssociatedTokenAccountIdempotentInstruction(
				feePayer, receiverAta, payTo, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
			),
		);
	}
	ixs.push(
		createTransferCheckedInstruction(
			senderAta, mint, receiverAta, buyerPubkey, amount, mintDecimals, [], TOKEN_PROGRAM_ID,
		),
	);

	const blockhash = await getRecentBlockhash(conn, rpc);
	const message = new TransactionMessage({
		payerKey: feePayer,
		recentBlockhash: blockhash,
		instructions: ixs,
	}).compileToV0Message();
	const vtx = new VersionedTransaction(message);

	return {
		network: accept.network,
		tx_base64: Buffer.from(vtx.serialize()).toString('base64'),
		recent_blockhash: blockhash,
	};
}

const BUILDER_CODE_PATTERN = /^[a-z0-9_]{1,32}$/;
function sanitizeBuilderCode(builderCode) {
	if (!builderCode || typeof builderCode !== 'object') return null;
	const a = builderCode.a;
	if (typeof a !== 'string' || !BUILDER_CODE_PATTERN.test(a)) return null;
	const out = { a };
	if (typeof builderCode.w === 'string' && BUILDER_CODE_PATTERN.test(builderCode.w)) out.w = builderCode.w;
	if (Array.isArray(builderCode.s)) {
		const s = builderCode.s.filter((x) => typeof x === 'string' && BUILDER_CODE_PATTERN.test(x)).slice(0, 32);
		if (s.length) out.s = s;
	}
	return out;
}

/**
 * Wrap a buyer-signed Solana transaction into the base64 `X-PAYMENT` envelope.
 *
 * @param {object} args
 * @param {object} args.accept            the same accept entry used in prepare
 * @param {string} args.signedTxBase64    base64 of the fully buyer-signed v0 tx
 * @param {string} args.resourceUrl       absolute URL of the paid resource
 * @param {object} [args.builderCode]     optional ERC-8021 builder-code echo
 * @returns {{ x_payment: string }}
 */
export function encodeX402Payment({ accept, signedTxBase64, resourceUrl, builderCode }) {
	validateAccept(accept);
	if (typeof signedTxBase64 !== 'string' || signedTxBase64.length < 40) {
		throw new CheckoutError(400, 'invalid_request', 'signedTxBase64 is required');
	}
	let url;
	try {
		url = new URL(resourceUrl).href;
	} catch {
		throw new CheckoutError(400, 'invalid_request', 'resourceUrl must be an absolute URL');
	}

	const payload = {
		x402Version: X402_VERSION,
		scheme: 'exact',
		network: accept.network,
		resource: { url, mimeType: 'application/json' },
		accepted: accept,
		payload: { transaction: signedTxBase64 },
	};
	const echo = sanitizeBuilderCode(builderCode);
	if (echo) payload.extensions = { 'builder-code': echo };

	return { x_payment: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') };
}

/**
 * Route an action ('prepare' | 'encode') to its handler and return a plain
 * `{ status, body }` pair the framework adapters serialize as JSON. Accepts the
 * camelCase fields the helpers use *and* the snake_case fields the browser modal
 * POSTs (`signed_tx_base64`, `resource_url`, `builder_code`).
 *
 * @param {object} args
 * @param {'prepare'|'encode'} args.action
 * @param {object} args.body   parsed JSON request body
 * @param {object} [args.options] { rpcUrl, devnetRpcUrl }
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleCheckout({ action, body = {}, options = {} }) {
	try {
		if (action === 'prepare') {
			const data = await prepareSolanaCheckout({
				accept: body.accept,
				buyer: body.buyer,
				rpcUrl: options.rpcUrl,
				devnetRpcUrl: options.devnetRpcUrl,
			});
			return { status: 200, body: data };
		}
		if (action === 'encode') {
			const data = encodeX402Payment({
				accept: body.accept,
				signedTxBase64: body.signedTxBase64 ?? body.signed_tx_base64,
				resourceUrl: body.resourceUrl ?? body.resource_url,
				builderCode: body.builderCode ?? body.builder_code,
			});
			return { status: 200, body: data };
		}
		return {
			status: 404,
			body: { error: 'not_found', error_description: `unknown action: ${action ?? '(none)'}` },
		};
	} catch (err) {
		if (err instanceof CheckoutError) {
			return { status: err.status, body: { error: err.code, error_description: err.message } };
		}
		// Unexpected (RPC down, malformed tx). Surface a generic 502 — the caller
		// shows "try again"; the real cause is in your server logs.
		return {
			status: 502,
			body: { error: 'checkout_failed', error_description: 'Could not build the Solana payment. Try again.' },
		};
	}
}
