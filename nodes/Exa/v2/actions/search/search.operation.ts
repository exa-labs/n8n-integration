import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { contentsOptions, simplifyField } from '../common.descriptions';
import type { ExaSearchResponse } from '../../helpers/interfaces';
import type { ContentsUiOptions } from '../../helpers/utils';
import { buildContentsPayload, parseJsonParameter, splitList } from '../../helpers/utils';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. companies building AI evaluation tooling',
		description: 'What to search the web for. Plain natural language works best.',
	},
	{
		displayName: 'Search Type',
		name: 'searchType',
		type: 'options',
		default: 'auto',
		options: [
			{
				name: 'Auto',
				value: 'auto',
				description: 'Balanced default that picks the best mode for the query',
			},
			{ name: 'Deep', value: 'deep', description: 'Agentic multi-step search for hard queries' },
			{
				name: 'Deep Lite',
				value: 'deep-lite',
				description: 'Cheaper agentic search for moderately hard queries',
			},
			{
				name: 'Deep Reasoning',
				value: 'deep-reasoning',
				description: 'Highest-effort agentic search with reasoning over sources',
			},
			{ name: 'Fast', value: 'fast', description: 'Low latency with fresh results' },
			{ name: 'Instant', value: 'instant', description: 'Lowest latency, cached-first results' },
		],
		description:
			'How hard Exa should work on the query. Deep modes are slower and cost more per search.',
	},
	{
		displayName: 'Number of Results',
		name: 'numResults',
		type: 'number',
		default: 10,
		typeOptions: { minValue: 1, maxValue: 100 },
		description:
			'Number of results to return, between 1 and 100. Limits vary by search type and plan; contact hello@exa.ai for higher limits.',
	},
	{
		displayName: 'Output Format',
		name: 'outputFormat',
		type: 'options',
		default: 'results',
		options: [
			{ name: 'Results Only', value: 'results', description: 'Return the ranked result list' },
			{
				name: 'Text',
				value: 'text',
				description: 'Also synthesize a written answer grounded in the results',
			},
			{
				name: 'Structured (JSON Schema)',
				value: 'structured',
				description: 'Also synthesize JSON matching a schema you provide',
			},
		],
		description:
			'Synthesized output works with every search type, not just the deep ones. When set, the node returns the synthesized output instead of the raw result list.',
	},
	{
		displayName: 'Output Description',
		name: 'outputDescription',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		displayOptions: { show: { outputFormat: ['text'] } },
		placeholder: 'e.g. A two paragraph brief with inline citations',
		description: 'What the synthesized text should contain',
	},
	{
		displayName: 'Output Schema',
		name: 'outputSchema',
		type: 'json',
		default:
			'{\n  "type": "object",\n  "properties": {\n    "companies": {\n      "type": "array",\n      "items": { "type": "string" }\n    }\n  },\n  "required": ["companies"]\n}',
		displayOptions: { show: { outputFormat: ['structured'] } },
		description: 'JSON Schema for the structured output Exa should return',
	},
	{
		displayName: 'Contents',
		name: 'contents',
		type: 'collection',
		placeholder: 'Add Content Option',
		default: {},
		description:
			'What to extract from each result page. Leave empty to return links and metadata only, which is the cheapest and fastest option.',
		options: contentsOptions,
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Additional Queries',
				name: 'additionalQueries',
				type: 'string',
				default: '',
				placeholder: 'e.g. AI eval startups, LLM testing companies',
				description:
					'Comma-separated query variations. Only used by the deep search types.',
			},
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				default: 'company',
				options: [
					{ name: 'Company', value: 'company' },
					{ name: 'Financial Report', value: 'financial report' },
					{ name: 'News', value: 'news' },
					{ name: 'People', value: 'people' },
					{ name: 'Personal Site', value: 'personal site' },
					{ name: 'Publication', value: 'publication' },
				],
				description:
					'Restrict results to a dedicated Exa index. The people and company indices ignore domain and text filters.',
			},
			{
				displayName: 'End Published Date',
				name: 'endPublishedDate',
				type: 'dateTime',
				default: '',
				description: 'Only return results published before this date',
			},
			{
				displayName: 'Exclude Domains',
				name: 'excludeDomains',
				type: 'string',
				default: '',
				placeholder: 'e.g. reddit.com, pinterest.com',
				description: 'Comma-separated domains or domain paths to exclude',
			},
			{
				displayName: 'Exclude Text',
				name: 'excludeText',
				type: 'string',
				default: '',
				description: 'Drop results whose page text contains this string',
			},
			{
				displayName: 'Include Domains',
				name: 'includeDomains',
				type: 'string',
				default: '',
				placeholder: 'e.g. arxiv.org, nature.com/articles',
				description: 'Comma-separated domains or domain paths to restrict results to',
			},
			{
				displayName: 'Include Text',
				name: 'includeText',
				type: 'string',
				default: '',
				description: 'Only keep results whose page text contains this string',
			},
			{
				displayName: 'Moderation',
				name: 'moderation',
				type: 'boolean',
				default: false,
				description: 'Whether to filter unsafe content out of the results',
			},
			{
				displayName: 'Start Published Date',
				name: 'startPublishedDate',
				type: 'dateTime',
				default: '',
				description: 'Only return results published after this date',
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description:
					'Extra instructions for synthesized output, such as source preferences or tone',
			},
			{
				displayName: 'User Location',
				name: 'userLocation',
				type: 'string',
				default: '',
				placeholder: 'e.g. US',
				description: 'Two-letter ISO country code used to localize results',
			},
		],
	},
	simplifyField,
];

export const description = updateDisplayOptions(
	{ show: { resource: ['search'], operation: ['search'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const body: IDataObject = {
		query: this.getNodeParameter('query', i) as string,
		type: this.getNodeParameter('searchType', i) as string,
		numResults: this.getNodeParameter('numResults', i) as number,
	};

	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const contentsUi = this.getNodeParameter('contents', i, {}) as ContentsUiOptions;
	const outputFormat = this.getNodeParameter('outputFormat', i) as string;
	const simplify = this.getNodeParameter('simplify', i) as boolean;

	for (const key of ['startPublishedDate', 'endPublishedDate', 'includeText', 'excludeText'] as const) {
		if (options[key]) body[key] = options[key];
	}
	if (options.category) body.category = options.category;
	if (options.userLocation) body.userLocation = options.userLocation;
	if (options.moderation) body.moderation = true;
	if (options.systemPrompt) body.systemPrompt = options.systemPrompt;

	const includeDomains = splitList(options.includeDomains as string);
	if (includeDomains.length) body.includeDomains = includeDomains;
	const excludeDomains = splitList(options.excludeDomains as string);
	if (excludeDomains.length) body.excludeDomains = excludeDomains;
	const additionalQueries = splitList(options.additionalQueries as string);
	if (additionalQueries.length) body.additionalQueries = additionalQueries;

	if (options.includeText) body.includeText = [options.includeText as string];
	if (options.excludeText) body.excludeText = [options.excludeText as string];

	if (outputFormat === 'text') {
		const outputDescription = this.getNodeParameter('outputDescription', i, '') as string;
		body.outputSchema = {
			type: 'text',
			...(outputDescription ? { description: outputDescription } : {}),
		};
	} else if (outputFormat === 'structured') {
		const schema = parseJsonParameter(
			this.getNode(),
			this.getNodeParameter('outputSchema', i) as string,
			'Output Schema',
			i,
		);
		body.outputSchema = { type: 'object', ...schema };
	}

	const contents = buildContentsPayload(contentsUi);
	if (Object.keys(contents).length) body.contents = contents;

	const response = (await apiRequest.call(this, 'POST', '/search', body)) as ExaSearchResponse;

	if (!simplify) {
		return [{ json: response, pairedItem: { item: i } }];
	}

	if (response.output) {
		return [{ json: response.output, pairedItem: { item: i } }];
	}

	return (response.results ?? []).map((result) => ({
		json: result,
		pairedItem: { item: i },
	}));
}
