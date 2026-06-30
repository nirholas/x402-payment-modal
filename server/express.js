// Express adapter for the Solana checkout endpoints.
//
//   import express from 'express';
//   import { x402CheckoutRouter } from '@nirholas/x402-payment-modal/server/express';
//
//   const app = express();
//   app.use(express.json());
//   app.use('/api/x402-checkout', x402CheckoutRouter({ rpcUrl: process.env.SOLANA_RPC_URL }));
//
// The modal POSTs to `/api/x402-checkout?action=prepare` and `?action=encode`.
// CORS is permissive (the drop-in modal runs on any origin); tighten `origin`
// via the option if you only serve your own pages.

import { handleCheckout } from './checkout.js';

/**
 * @param {object} [options]
 * @param {string}   [options.rpcUrl]        Solana mainnet RPC URL
 * @param {string[]} [options.rpcUrls]       Solana mainnet RPC URLs for failover (preferred under load)
 * @param {string}   [options.devnetRpcUrl]  Solana devnet RPC URL
 * @param {string[]} [options.devnetRpcUrls] Solana devnet RPC URLs for failover
 * @param {Function} [options.logger]        called with the root cause on unexpected failures
 * @param {string}   [options.origin]        Access-Control-Allow-Origin (default '*')
 * @returns {import('express').RequestHandler}
 */
export function x402CheckoutRouter(options = {}) {
	const allowOrigin = options.origin || '*';
	return async function x402CheckoutHandler(req, res) {
		res.setHeader('Access-Control-Allow-Origin', allowOrigin);
		res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'content-type, x-idempotency-key');
		if (req.method === 'OPTIONS') {
			res.status(204).end();
			return;
		}
		if (req.method !== 'POST') {
			res.status(405).json({ error: 'method_not_allowed', error_description: 'use POST' });
			return;
		}
		const action = req.query?.action;
		const body = req.body && typeof req.body === 'object' ? req.body : {};
		const { status, body: out } = await handleCheckout({ action, body, options });
		res.status(status).json(out);
	};
}

export default x402CheckoutRouter;
