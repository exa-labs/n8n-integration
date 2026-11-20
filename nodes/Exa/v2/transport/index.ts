import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, jsonParse, sleep } from 'n8n-workflow';

import packageJson from '../../../../package.json';
import type { ExaAgentRunEvent } from '../helpers/interfaces';

export const EXA_BASE_URL = 'https://api.exa.ai';

type RequestContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

const TRANSIENT_HTTP_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_NETWORK_CODES = new Set([
	'ECONNRESET',
	'ECONNREFUSED',
	'ECONNABORTED',
	'ETIMEDOUT',
	'EAI_AGAIN',
	'EPIPE',
]);

/**
 * How an event stream ended: `stopped` when `shouldStop` matched an event,
 * `timeout` when the caller's budget ran out, `closed` when the server or the
 * network ended it first. The events received so far are always returned, so a
 * caller never loses the run ID it needs to recover.
 */
export type StreamOutcome = 'stopped' | 'timeout' | 'closed';

export interface StreamResult {
	events: ExaAgentRunEvent[];
	outcome: StreamOutcome;
	error?: Error;
}

interface ResponseStream {
	on(event: 'data', listener: (chunk: Buffer | string) => void): void;
	on(event: 'end', listener: () => void): void;
	on(event: 'error', listener: (error: Error) => void): void;
	destroy(): void;
}

const DOCS_BY_ENDPOINT: Array<[RegExp, string]> = [
	[/^\/search/, 'https://exa.ai/docs/reference/search'],
	[/^\/contents/, 'https://exa.ai/docs/reference/get-contents'],
	[/^\/answer/, 'https://exa.ai/docs/reference/answer'],
	[/^\/agent/, 'https://exa.ai/docs/reference/agent-api-guide'],
	[/^\/monitors/, 'https://exa.ai/docs/reference/monitors'],
];

function docsUrl(endpoint: string): string {
	const match = DOCS_BY_ENDPOINT.find(([pattern]) => pattern.test(endpoint));
	return match ? match[1] : 'https://exa.ai/docs';
}

function exaErrorBody(error: unknown): unknown {
	const candidate = error as {
		context?: { data?: unknown };
		response?: { body?: unknown; data?: unknown };
		cause?: { response?: { body?: unknown; data?: unknown } };
		errorResponse?: unknown;
	};

	return (
		candidate.context?.data ??
		candidate.response?.body ??
		candidate.response?.data ??
		candidate.cause?.response?.body ??
		candidate.cause?.response?.data ??
		candidate.errorResponse
	);
}

export function toNodeApiError(node: INode, error: unknown, endpoint: string): NodeApiError {
	const responseBody = exaErrorBody(error);
	const { message, code } = parseExaError(responseBody);
	const httpCode = (error as { httpCode?: string }).httpCode;
	const errorResponse: JsonObject = {
		error: message ?? (error as Error).message,
		...(code ? { tag: code } : {}),
		...(httpCode ? { httpCode } : {}),
	};

	return new NodeApiError(node, errorResponse, {
		message: message ?? (error as Error).message,
		description: [code, `See ${docsUrl(endpoint)} for valid parameters.`].filter(Boolean).join(' — '),
		httpCode,
	});
}

export function parseExaError(body: unknown): { message?: string; code?: string } {
	let parsed = body;
	if (typeof parsed === 'string') {
		parsed = jsonParse<IDataObject>(parsed, { fallbackValue: { error: parsed } });
	}
	if (typeof parsed !== 'object' || parsed === null) return {};

	const { error } = parsed as IDataObject;
	if (typeof error === 'string') {
		return { message: error, code: (parsed as IDataObject).tag as string | undefined };
	}
	if (typeof error === 'object' && error !== null) {
		const { message, code } = error as IDataObject;
		return {
			message: typeof message === 'string' ? message : undefined,
			code: typeof code === 'string' ? code : undefined,
		};
	}
	return {};
}

/**
 * Whether a failed request is worth repeating: rate limits, gateway and server
 * errors, and dropped connections. Client errors (400, 401, 404, ...) are not.
 */
export function isTransientError(error: unknown): boolean {
	const candidate = error as {
		httpCode?: string | number;
		statusCode?: number;
		status?: number;
		code?: string;
		response?: { status?: number };
		cause?: { code?: string; status?: number; response?: { status?: number } };
	};
	const status = Number(
		candidate.httpCode ??
			candidate.statusCode ??
			candidate.status ??
			candidate.response?.status ??
			candidate.cause?.response?.status ??
			candidate.cause?.status,
	);
	if (Number.isFinite(status) && status > 0) return TRANSIENT_HTTP_CODES.has(status);
	const code = candidate.code ?? candidate.cause?.code;
	return code !== undefined && TRANSIENT_NETWORK_CODES.has(code);
}

/** Exponential backoff for the n-th retry (1-based), capped at 30 seconds. */
export function retryDelayMs(attempt: number): number {
	return Math.min(1000 * 2 ** (attempt - 1), 30_000);
}

function requestOptions(
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject,
	qs: IDataObject,
	options: Partial<IHttpRequestOptions>,
): IHttpRequestOptions {
	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${EXA_BASE_URL}${endpoint}`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'x-exa-integration': 'n8n',
			'User-Agent': `exa-n8n ${packageJson.version}`,
		},
		json: true,
		...options,
	};

	if (Object.keys(body).length) requestOptions.body = body;
	if (Object.keys(qs).length) requestOptions.qs = qs;
	return requestOptions;
}

export async function apiRequest(
	this: RequestContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	options: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'exaApi',
			requestOptions(method, endpoint, body, qs, options),
		)) as IDataObject;
	} catch (error) {
		throw toNodeApiError(this.getNode(), error, endpoint);
	}
}

/**
 * A read that is repeated with backoff on transient failures until `deadline`
 * (epoch ms). Only for idempotent requests: a retried create could start a
 * second billable run.
 */
export async function apiReadWithRetry(
	this: IExecuteFunctions,
	endpoint: string,
	deadline: number,
	qs: IDataObject = {},
): Promise<IDataObject> {
	for (let attempt = 1; ; attempt++) {
		try {
			return (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'exaApi',
				requestOptions('GET', endpoint, {}, qs, {}),
			)) as IDataObject;
		} catch (error) {
			const delay = retryDelayMs(attempt);
			if (!isTransientError(error) || Date.now() + delay > deadline) {
				throw toNodeApiError(this.getNode(), error, endpoint);
			}
			await sleep(delay);
		}
	}
}

/**
 * Reads a cursor-paginated list endpoint (`{ data, hasMore, nextCursor }`)
 * until `limit` items are collected or the list ends.
 */
export async function getAllPages(
	this: IExecuteFunctions,
	endpoint: string,
	limit: number,
	qs: IDataObject = {},
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	let cursor: string | undefined;
	do {
		const page: IDataObject = { ...qs, limit: Math.min(100, limit - items.length) };
		if (cursor) page.cursor = cursor;
		const response = await apiRequest.call(this, 'GET', endpoint, {}, page);
		items.push(...((response.data as IDataObject[]) ?? []));
		cursor = response.hasMore ? (response.nextCursor as string) : undefined;
	} while (cursor && items.length < limit);
	return items.slice(0, limit);
}

export function parseEventBlock(block: string): ExaAgentRunEvent | undefined {
	let id: string | undefined;
	let name: string | undefined;
	const dataLines: string[] = [];

	for (const line of block.split('\n')) {
		if (line.startsWith('id:')) id = line.slice(3).trim();
		else if (line.startsWith('event:')) name = line.slice(6).trim();
		else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
	}

	const data = dataLines.join('');
	if (!data || data === '[DONE]') return undefined;

	const parsed = jsonParse<IDataObject | null>(data, { fallbackValue: null });
	if (parsed === null) return undefined;

	return {
		...(id ? { id } : {}),
		...(name ? { event: name } : {}),
		data: parsed,
	};
}

export async function streamEvents(
	this: IExecuteFunctions,
	endpoint: string,
	{
		method = 'GET',
		body = {},
		qs = {},
		headers = {},
		timeoutMs,
		shouldStop,
	}: {
		method?: IHttpRequestMethods;
		body?: IDataObject;
		qs?: IDataObject;
		headers?: IDataObject;
		timeoutMs?: number;
		shouldStop?: (event: ExaAgentRunEvent) => boolean;
	} = {},
): Promise<StreamResult> {
	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${EXA_BASE_URL}${endpoint}`,
		headers: {
			Accept: 'text/event-stream',
			'Content-Type': 'application/json',
			'x-exa-integration': 'n8n',
			'User-Agent': `exa-n8n ${packageJson.version}`,
			...headers,
		},
		json: false,
		encoding: 'stream',
		returnFullResponse: true,
	};

	if (Object.keys(body).length) requestOptions.body = body;
	if (Object.keys(qs).length) requestOptions.qs = qs;

	let response: { body: ResponseStream };
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'exaApi',
			requestOptions,
		)) as { body: ResponseStream };
	} catch (error) {
		throw toNodeApiError(this.getNode(), error, endpoint);
	}

	const events: ExaAgentRunEvent[] = [];
	const stream = response.body;
	const deadline = timeoutMs ? Date.now() + timeoutMs : undefined;

	return await new Promise<StreamResult>((resolve) => {
		let buffer = '';
		let settled = false;

		const finish = (outcome: StreamOutcome, error?: Error) => {
			if (settled) return;
			settled = true;
			stream.destroy();
			resolve({ events, outcome, ...(error ? { error } : {}) });
		};

		if (timeoutMs) {
			void sleep(timeoutMs).then(() => finish('timeout'));
		}

		stream.on('data', (chunk: Buffer | string) => {
			if (deadline && Date.now() > deadline) {
				finish('timeout');
				return;
			}

			buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
			const blocks = buffer.split('\n\n');
			buffer = blocks.pop() ?? '';

			for (const block of blocks) {
				const event = parseEventBlock(block);
				if (event === undefined) continue;

				events.push(event);
				if (shouldStop?.(event)) finish('stopped');
			}
		});
		stream.on('end', () => finish('closed'));
		stream.on('error', (error: Error) => finish('closed', error));
	});
}
