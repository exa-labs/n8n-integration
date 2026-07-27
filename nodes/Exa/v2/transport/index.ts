import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, jsonParse } from 'n8n-workflow';
import type { Readable } from 'stream';

import packageJson from '../../../../package.json';
import type { ExaAgentRunEvent } from '../helpers/interfaces';

export const EXA_BASE_URL = 'https://api.exa.ai';

const DOCS_BY_ENDPOINT: Array<[RegExp, string]> = [
	[/^\/search/, 'https://exa.ai/docs/reference/search'],
	[/^\/contents/, 'https://exa.ai/docs/reference/get-contents'],
	[/^\/answer/, 'https://exa.ai/docs/reference/answer'],
	[/^\/agent/, 'https://exa.ai/docs/reference/agent-api-guide'],
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

export async function apiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	options: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
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

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'exaApi',
			requestOptions,
		)) as IDataObject;
	} catch (error) {
		throw toNodeApiError(this.getNode(), error, endpoint);
	}
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
): Promise<ExaAgentRunEvent[]> {
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

	let response: { body: Readable };
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'exaApi',
			requestOptions,
		)) as { body: Readable };
	} catch (error) {
		throw toNodeApiError(this.getNode(), error, endpoint);
	}

	const events: ExaAgentRunEvent[] = [];
	const stream = response.body;
	const deadline = timeoutMs ? Date.now() + timeoutMs : undefined;

	await new Promise<void>((resolve, reject) => {
		let buffer = '';
		let settled = false;

		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			clearInterval(timer);
			stream.destroy();
			if (error) reject(error);
			else resolve();
		};

		const timer = setInterval(() => {
			if (deadline && Date.now() > deadline) {
				finish(new Error('Timed out while waiting for Exa agent events'));
			}
		}, 500);

		stream.on('data', (chunk: Buffer) => {
			buffer += chunk.toString('utf8');
			const blocks = buffer.split('\n\n');
			buffer = blocks.pop() ?? '';

			for (const block of blocks) {
				const event = parseEventBlock(block);
				if (event === undefined) continue;

				events.push(event);
				if (shouldStop?.(event)) finish();
			}
		});
		stream.on('end', () => finish());
		stream.on('error', (error: Error) => finish(error));
	});

	return events;
}
