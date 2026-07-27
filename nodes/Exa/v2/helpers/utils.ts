import type { IDataObject, INode } from 'n8n-workflow';
import { NodeOperationError, jsonParse } from 'n8n-workflow';

import type { ExaContentStatus } from './interfaces';

export function splitList(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

export function parseJsonParameter(
	node: INode,
	value: string | IDataObject | undefined,
	parameterName: string,
	itemIndex: number,
): IDataObject | undefined {
	if (value === undefined || value === '') return undefined;
	if (typeof value === 'object') return value;

	const parsed = jsonParse<IDataObject | null>(value, { fallbackValue: null });
	if (parsed === null || typeof parsed !== 'object') {
		throw new NodeOperationError(node, `${parameterName} is not valid JSON`, {
			itemIndex,
			description: 'Provide a JSON object, for example {"type":"object","properties":{}}',
		});
	}
	return parsed;
}

export interface ContentsUiOptions {
	text?: boolean;
	textMaxCharacters?: number;
	textVerbosity?: string;
	textIncludeHtmlTags?: boolean;
	highlights?: boolean;
	highlightsQuery?: string;
	highlightsMaxCharacters?: number;
	summary?: boolean;
	summaryQuery?: string;
	maxAgeHours?: number;
	livecrawlTimeout?: number;
	subpages?: number;
	subpageTarget?: string;
	links?: number;
	imageLinks?: number;
}

/**
 * Builds the Exa content-extraction payload shared by `/search` and `/contents`.
 */
export function buildContentsPayload(options: ContentsUiOptions): IDataObject {
	const contents: IDataObject = {};

	if (options.text) {
		const text: IDataObject = {};
		if (options.textMaxCharacters) text.maxCharacters = options.textMaxCharacters;
		if (options.textVerbosity) text.verbosity = options.textVerbosity;
		if (options.textIncludeHtmlTags) text.includeHtmlTags = true;
		contents.text = Object.keys(text).length ? text : true;
	}

	if (options.highlights) {
		const highlights: IDataObject = {};
		if (options.highlightsQuery) highlights.query = options.highlightsQuery;
		if (options.highlightsMaxCharacters) highlights.maxCharacters = options.highlightsMaxCharacters;
		contents.highlights = Object.keys(highlights).length ? highlights : true;
	}

	if (options.summary) {
		contents.summary = options.summaryQuery ? { query: options.summaryQuery } : {};
	}

	if (options.maxAgeHours !== undefined && options.maxAgeHours >= -1) {
		contents.maxAgeHours = options.maxAgeHours;
	}
	if (options.livecrawlTimeout) contents.livecrawlTimeout = options.livecrawlTimeout;
	if (options.subpages) contents.subpages = options.subpages;
	if (options.subpageTarget) {
		const targets = splitList(options.subpageTarget);
		if (targets.length === 1) contents.subpageTarget = targets[0];
		else if (targets.length > 1) contents.subpageTarget = targets;
	}

	const extras: IDataObject = {};
	if (options.links) extras.links = options.links;
	if (options.imageLinks) extras.imageLinks = options.imageLinks;
	if (Object.keys(extras).length) contents.extras = extras;

	return contents;
}

/**
 * `/contents` answers 200 even when individual URLs fail, so the per-URL status
 * is merged onto each result and failed URLs are surfaced as their own items.
 */
export function mergeContentStatuses(
	results: IDataObject[],
	statuses: ExaContentStatus[] = [],
): IDataObject[] {
	const byId = new Map(statuses.map((status) => [status.id, status]));
	const items = results.map((result) => {
		const status = byId.get(result.id as string) ?? byId.get(result.url as string);
		if (status) byId.delete(status.id);
		return status ? { ...result, status: status.status, statusSource: status.source } : result;
	});

	for (const status of byId.values()) {
		if (status.status === 'success') continue;
		items.push({ id: status.id, url: status.id, status: status.status, error: status.error });
	}

	return items;
}
