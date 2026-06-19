// Type definitions for @three-ws/x402-payment-modal

/** Client-side spending caps, enforced in localStorage before each payment. */
export interface SpendingCaps {
	/** Max atomic micro-USD per single call. */
	maxPerCall?: string | number;
	/** Max atomic micro-USD per rolling UTC hour. */
	maxPerHour?: string | number;
	/** Max atomic micro-USD per rolling UTC day. */
	maxPerDay?: string | number;
}

/** Options for {@link pay}. */
export interface PayOptions {
	/** URL of the paid (x402) endpoint. Required. */
	endpoint: string;
	/** HTTP method to call the endpoint with. Defaults to GET, or POST if `body` is set. */
	method?: string;
	/** Request body. Objects are JSON-stringified; strings are sent as-is. */
	body?: unknown;
	/** Extra request headers merged into the paid call. */
	headers?: Record<string, string>;
	/** Merchant name shown in the modal header. */
	merchant?: string;
	/** Action label shown in the modal header. */
	action?: string;
	/** Skip the wallet picker and open the wallet directly when exactly one supported wallet is detected. */
	autoConnect?: boolean;
	/** Client-side spending caps (stablecoin assets only in the browser). */
	caps?: SpendingCaps;
}

/** Settlement details returned by the facilitator on a paid call. */
export interface PaymentReceipt {
	network?: string;
	transaction?: string;
	payer?: string;
}

/** SIWX re-entry details when the wallet signed in instead of paying. */
export interface SiwxReceipt {
	address: string;
	network: string | number;
}

/** Resolved value of {@link pay}. */
export interface PayResult {
	ok: true;
	/** Parsed JSON (or text) the paid endpoint returned. */
	result: unknown;
	/** Present on a paid call. */
	payment?: PaymentReceipt;
	/** Present when re-entry happened via SIWX instead of a payment. */
	siwx?: SiwxReceipt;
	response: {
		status: number;
		headers: Record<string, string>;
	};
}

/** Branding shown in the modal footer. */
export interface BrandConfig {
	name?: string;
	url?: string;
}

/** ERC-8021 builder-code self-attribution echoed when the 402 challenge declares one. */
export interface BuilderCodeConfig {
	wallet?: string;
	service?: string;
}

/** CDN URLs for the crypto helpers loaded on demand. */
export interface EsmConfig {
	solanaWeb3?: string;
	nobleHashesSha3?: string;
}

/** Host configuration. See {@link configure}. */
export interface X402Config {
	checkoutOrigin?: string | null;
	checkoutPath?: string;
	brand?: BrandConfig;
	footerNote?: string;
	builderCode?: BuilderCodeConfig;
	esm?: EsmConfig;
}

/**
 * Override host configuration (Solana checkout origin, branding, builder-code,
 * esm.sh CDN URLs). Shallow-merges nested objects. Call before the first `pay()`.
 * Returns the resolved config.
 */
export function configure(opts?: X402Config): Required<X402Config>;

/**
 * Open the payment modal for an x402 endpoint and resolve when the user completes
 * (or rejects with `{ code: 'cancelled' }` if dismissed).
 */
export function pay(opts: PayOptions): Promise<PayResult>;

/** Bind all `[data-x402-endpoint]` elements on the page (called automatically on load). */
export function init(): void;

/** Library version. */
export const version: string;

/** Solana USDC mint (mainnet). */
export const USDC_MINT_SOLANA: string;
/** $THREE — the three.ws utility token mint. Recognized by the modal so a 402
 *  `accept` using it renders as THREE without merchant-supplied metadata. */
export const THREE_MINT: string;

export interface KnownSolanaToken {
	symbol: string;
	name: string;
	decimals: number;
	stable?: boolean;
	accent?: string;
	glyph?: string;
}

/** Well-known Solana settlement assets, keyed by mint address. */
export const KNOWN_SOLANA_TOKENS: Readonly<Record<string, KnownSolanaToken>>;

/** Global exposed for non-module / inline-script usage. */
declare global {
	interface Window {
		X402?: {
			pay: typeof pay;
			init: typeof init;
			configure: typeof configure;
			version: string;
			tokens: {
				USDC_MINT_SOLANA: string;
				THREE_MINT: string;
				KNOWN_SOLANA_TOKENS: Readonly<Record<string, KnownSolanaToken>>;
			};
		};
	}
}
