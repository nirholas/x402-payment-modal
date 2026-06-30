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

/** Solana USDC mint (mainnet). */
export const USDC_MINT_SOLANA: string;
/** THREE — an optional opt-in SPL token mint (used only when an endpoint
 *  chooses to accept it alongside USDC). */
export const THREE_MINT: string;

export interface WellKnownToken {
	mint: string;
	symbol: string;
	name: string;
	decimals: number;
}

/** Well-known Solana settlement assets, keyed by lowercase shortcut. */
export const WELL_KNOWN_SOLANA_TOKENS: {
	usdc: WellKnownToken;
	three: WellKnownToken;
};

/**
 * Build one x402 Solana `accept` entry. Pass `token: 'usdc' | 'three'` for a
 * well-known asset or an explicit `mint`, and the price as atomic `amount` or
 * human `uiAmount`.
 */
export function solanaAccept(args: {
	token?: 'usdc' | 'three';
	mint?: string;
	payTo: string;
	feePayer: string;
	amount?: string | number | bigint;
	uiAmount?: string | number;
	decimals?: number;
	name?: string;
	network?: string;
	maxTimeoutSeconds?: number;
}): SolanaAccept;

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
