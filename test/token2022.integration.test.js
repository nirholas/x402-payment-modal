// Opt-in integration test: confirms prepareSolanaCheckout builds a valid
// transaction for BOTH a legacy SPL Token mint (USDC) and a Token-2022 mint
// (THREE). It needs a live Solana mainnet RPC, so it is skipped unless
// X402_INTEGRATION is set — the default `npm test` stays fully offline.
//
//   X402_INTEGRATION=1 npm test
//   X402_INTEGRATION=1 SOLANA_RPC_URL=https://your-rpc npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareSolanaCheckout, solanaAccept } from '../server/checkout.js';

const RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const run = process.env.X402_INTEGRATION ? test : test.skip;

// Any valid base58 owner works as buyer/payTo/feePayer — prepare only reads the
// mint account and a blockhash; it never inspects the buyer's balance.
const ADDR = 'So11111111111111111111111111111111111111112';

run('prepareSolanaCheckout builds a tx for legacy USDC', async () => {
	const accept = solanaAccept({ token: 'usdc', uiAmount: '0.001', payTo: ADDR, feePayer: ADDR });
	const prepared = await prepareSolanaCheckout({ accept, buyer: ADDR, rpcUrl: RPC });
	assert.equal(prepared.network, accept.network);
	assert.ok(Buffer.from(prepared.tx_base64, 'base64').length > 100);
});

run('prepareSolanaCheckout builds a tx for Token-2022 THREE', async () => {
	// THREE (FeMbDoX…pump) is owned by the Token-2022 program. Before the
	// program-detection fix this threw TokenInvalidAccountOwnerError.
	const accept = solanaAccept({ token: 'three', uiAmount: '1', payTo: ADDR, feePayer: ADDR });
	const prepared = await prepareSolanaCheckout({ accept, buyer: ADDR, rpcUrl: RPC });
	assert.equal(prepared.network, accept.network);
	assert.ok(Buffer.from(prepared.tx_base64, 'base64').length > 100);
});
