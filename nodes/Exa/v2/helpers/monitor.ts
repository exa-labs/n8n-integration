/**
 * Request builders and webhook verification for the Exa Monitors API
 * (`/monitors`), shared by the Exa node's Monitor resource and the Exa Trigger.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { IDataObject } from 'n8n-workflow';

import type { ContentsUiOptions } from './utils';
import { buildContentsPayload, splitList } from './utils';

export const MONITOR_WEBHOOK_EVENTS = [
	{
		name: 'Run Completed',
		value: 'monitor.run.completed',
		description: 'A run finished; the payload carries its results',
	},
	{ name: 'Run Created', value: 'monitor.run.created', description: 'A run started' },
	{ name: 'Monitor Created', value: 'monitor.created' },
	{ name: 'Monitor Updated', value: 'monitor.updated' },
	{ name: 'Monitor Deleted', value: 'monitor.deleted' },
];

export interface MonitorSearchInput {
	query: string;
	numResults?: number;
	includeDomains?: string;
	excludeDomains?: string;
	contents?: ContentsUiOptions;
}

/** The `search` object of a monitor. Unset fields are left out so Exa applies its defaults. */
export function buildMonitorSearch(input: MonitorSearchInput): IDataObject {
	const search: IDataObject = { query: input.query };
	if (input.numResults) search.numResults = input.numResults;
	const includeDomains = splitList(input.includeDomains);
	if (includeDomains.length) search.includeDomains = includeDomains;
	const excludeDomains = splitList(input.excludeDomains);
	if (excludeDomains.length) search.excludeDomains = excludeDomains;
	const contents = buildContentsPayload(input.contents ?? {});
	if (Object.keys(contents).length) search.contents = contents;
	return search;
}

/**
 * The monitor `trigger` for a schedule choice: an interval such as `1d`, or
 * `null` for a monitor that only runs when triggered by hand.
 */
export function buildMonitorTrigger(schedule: string, customPeriod?: string): IDataObject | null {
	const period = schedule === 'custom' ? customPeriod?.trim() : schedule;
	if (!period || schedule === 'none') return null;
	return { type: 'interval', period };
}

export type SignatureCheck =
	| { valid: true }
	| { valid: false; reason: 'missing-header' | 'malformed-header' | 'stale' | 'mismatch' };

/**
 * Verifies an `Exa-Signature: t=<unix seconds>,v1=<hex>` header, where the
 * signature is HMAC-SHA256 over `<t>.<raw body>` keyed by the monitor's
 * webhook secret. Rejects timestamps more than `toleranceSeconds` from now.
 */
export function verifyExaSignature(input: {
	header: string | undefined;
	rawBody: Buffer | string;
	secret: string;
	nowSeconds?: number;
	toleranceSeconds?: number;
}): SignatureCheck {
	if (!input.header) return { valid: false, reason: 'missing-header' };

	let timestamp: string | undefined;
	const signatures: string[] = [];
	for (const part of input.header.split(',')) {
		const separator = part.indexOf('=');
		if (separator < 0) continue;
		const key = part.slice(0, separator).trim();
		const value = part.slice(separator + 1).trim();
		if (key === 't') timestamp = value;
		else if (key === 'v1') signatures.push(value);
	}
	if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) {
		return { valid: false, reason: 'malformed-header' };
	}

	const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
	if (Math.abs(now - Number(timestamp)) > (input.toleranceSeconds ?? 300)) {
		return { valid: false, reason: 'stale' };
	}

	const body = typeof input.rawBody === 'string' ? Buffer.from(input.rawBody) : input.rawBody;
	const expected = createHmac('sha256', input.secret)
		.update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
		.digest();
	const matches = signatures.some((signature) => {
		const provided = Buffer.from(signature, 'hex');
		return provided.length === expected.length && timingSafeEqual(provided, expected);
	});
	return matches ? { valid: true } : { valid: false, reason: 'mismatch' };
}
