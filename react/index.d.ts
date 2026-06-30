import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { PayOptions, PayResult, X402Config } from '@three-ws/x402-payment-modal';

export type X402Status = 'idle' | 'paying' | 'done' | 'error';

export interface UseX402Return {
	/** Open the modal and run the 402 → sign → settle flow. Resolves to the result, or `undefined` if the user cancelled. */
	pay: (opts?: Partial<PayOptions>) => Promise<PayResult | undefined>;
	status: X402Status;
	result: PayResult | null;
	error: Error | null;
	reset: () => void;
	isPaying: boolean;
}

/** Payment hook with a small state machine. `defaults` are merged under every `pay()` call. */
export function useX402(defaults?: Partial<PayOptions>): UseX402Return;

/** Configure the modal before the first payment (resolves once applied). */
export function configure(opts?: X402Config): Promise<Required<X402Config>>;

export interface X402ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'onError' | 'children'> {
	endpoint: string;
	method?: string;
	body?: unknown;
	merchant?: string;
	action?: string;
	caps?: PayOptions['caps'];
	headers?: Record<string, string>;
	autoConnect?: boolean;
	label?: string;
	onResult?: (result: PayResult) => void;
	onError?: (error: Error) => void;
	children?: ReactNode;
}

/** Drop-in pay button. */
export function X402Button(props: X402ButtonProps): JSX.Element;
export default X402Button;
