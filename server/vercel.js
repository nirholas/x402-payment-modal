// Vercel / Next.js (pages API) adapter for the Solana checkout endpoints.
//
// Save as `api/x402-checkout.js`:
//
//   export { default } from '@three-ws/x402-payment-modal/server/vercel';
//
// or with options:
//
//   import { createVercelCheckoutHandler } from '@three-ws/x402-payment-modal/server/vercel';
//   export default createVercelCheckoutHandler({ rpcUrl: process.env.SOLANA_RPC_URL });
//
// The modal POSTs to this route with `?action=prepare` and `?action=encode`.

import { handleCheckout } from './checkout.js';

async function readJsonBody(req) {
	// Next.js pages API and Vercel Node functions usually pre-parse JSON into
	// req.body. When they don't (raw runtime), read the stream ourselves.
	if (req.body && typeof req.body === 'object') return req.body;
	if (typeof req.body === 'string' && req.body) {
		try { return JSON.parse(req.body); } catch { return {}; }
	}
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	if (!chunks.length) return {};
	try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

/**
 * @param {object} [options]  { rpcUrl, rpcUrls, devnetRpcUrl, devnetRpcUrls, logger, origin }
 * @returns {(req: any, res: any) => Promise<void>}
 */
export function createVercelCheckoutHandler(options = {}) {
	const allowOrigin = options.origin || '*';
	return async function handler(req, res) {
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
		const body = await readJsonBody(req);
		const { status, body: out } = await handleCheckout({ action, body, options });
		res.status(status).json(out);
	};
}

export default createVercelCheckoutHandler();
