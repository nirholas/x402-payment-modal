// Type definitions for @three-ws/x402-payment-modal/server

/** One x402 `accept` entry (scheme "exact", Solana network). */
export interface SolanaAccept {
	scheme: 'exact';
	network: string;
	/** Atomic integer amount as a string. */
	amount: string;
	/** Mint address (base58). */
	asset: string;
	/** Recipient address (base58). */
	payTo: string;
	maxTimeoutSeconds?: number;
	extra: {
		name?: string;
		decimals?: number;
		/** Facilitator sponsor account that pays the SOL network fee (base58). */
		feePayer: string;
		[key: string]: unknown;
	};
}

export interface CheckoutOptions {
	/** Solana mainnet RPC URL. */
	rpcUrl?: string;
	/** Solana devnet RPC URL. */
	devnetRpcUrl?: string;
	/** Access-Control-Allow-Origin for the adapters. Default '*'. */
	origin?: string;
}

export interface PrepareResult {
	network: string;
	tx_base64: string;
	recent_blockhash: string;
}

export interface BuilderCodeEcho {
	a: string;
	w?: string;
	s?: string[];
}

export const X402_VERSION: number;
export const NETWORK_SOLANA_MAINNET: string;
export const NETWORK_SOLANA_DEVNET: string;

export class CheckoutError extends Error {
	status: number;
	code: string;
}

export function isSolanaNetwork(network: string): boolean;

export function prepareSolanaCheckout(args: {
	accept: SolanaAccept;
	buyer: string;
	rpcUrl?: string;
	devnetRpcUrl?: string;
}): Promise<PrepareResult>;

export function encodeX402Payment(args: {
	accept: SolanaAccept;
	signedTxBase64: string;
	resourceUrl: string;
	builderCode?: BuilderCodeEcho;
}): { x_payment: string };

export function handleCheckout(args: {
	action: 'prepare' | 'encode' | string;
	body?: Record<string, unknown>;
	options?: CheckoutOptions;
}): Promise<{ status: number; body: Record<string, unknown> }>;
