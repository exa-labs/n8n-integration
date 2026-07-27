import type { INodeProperties } from 'n8n-workflow';

/**
 * Content-extraction knobs shared by `/search` and `/contents`.
 */
export const contentsOptions: INodeProperties[] = [
	{
		displayName: 'Highlights',
		name: 'highlights',
		type: 'boolean',
		default: false,
		description:
			'Whether to return LLM-selected excerpts. Best default for agent workflows.',
	},
	{
		displayName: 'Highlights Max Characters',
		name: 'highlightsMaxCharacters',
		type: 'number',
		default: 2000,
		typeOptions: { minValue: 1, maxValue: 10000 },
		displayOptions: { show: { highlights: [true] } },
		description: 'Character budget for highlights. Values below ~400 usually truncate too much.',
	},
	{
		displayName: 'Highlights Query',
		name: 'highlightsQuery',
		type: 'string',
		default: '',
		displayOptions: { show: { highlights: [true] } },
		description: 'Custom query that steers which excerpts are picked',
	},
	{
		displayName: 'Image Links',
		name: 'imageLinks',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 1000 },
		description: 'Number of image URLs to return per result',
	},
	{
		displayName: 'Links',
		name: 'links',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 1000 },
		description: 'Number of links to extract from each page',
	},
	{
		displayName: 'Livecrawl Timeout (Ms)',
		name: 'livecrawlTimeout',
		type: 'number',
		default: 10000,
		typeOptions: { minValue: 1, maxValue: 90000 },
		description: 'How long a live crawl may take before Exa gives up on a page',
	},
	{
		displayName: 'Max Age (Hours)',
		name: 'maxAgeHours',
		type: 'number',
		default: 24,
		typeOptions: { minValue: -1, maxValue: 720 },
		description:
			'Freshness control. Use cached content up to this age, 0 to always crawl live, -1 for cache only.',
	},
	{
		displayName: 'Subpage Target',
		name: 'subpageTarget',
		type: 'string',
		default: '',
		placeholder: 'e.g. pricing, about',
		description: 'Comma-separated terms used to pick which subpages to crawl',
	},
	{
		displayName: 'Subpages',
		name: 'subpages',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 100 },
		description: 'Number of linked subpages to crawl per result',
	},
	{
		displayName: 'Summary',
		name: 'summary',
		type: 'boolean',
		default: false,
		description:
			'Whether to return an LLM summary per result. Adds one LLM call per result, so use sparingly.',
	},
	{
		displayName: 'Summary Query',
		name: 'summaryQuery',
		type: 'string',
		default: '',
		displayOptions: { show: { summary: [true] } },
		description: 'Custom query for the generated summary',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'boolean',
		default: false,
		description: 'Whether to return the full cleaned page text',
	},
	{
		displayName: 'Text Include HTML Tags',
		name: 'textIncludeHtmlTags',
		type: 'boolean',
		default: false,
		displayOptions: { show: { text: [true] } },
		description: 'Whether to keep lightweight HTML tags instead of plain markdown-style text',
	},
	{
		displayName: 'Text Max Characters',
		name: 'textMaxCharacters',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 10000 },
		displayOptions: { show: { text: [true] } },
		description: 'Character cap for page text (0 for the Exa default)',
	},
	{
		displayName: 'Text Verbosity',
		name: 'textVerbosity',
		type: 'options',
		options: [
			{ name: 'Compact', value: 'compact', description: 'Main content only' },
			{ name: 'Standard', value: 'standard', description: 'Includes surrounding page context' },
			{ name: 'Full', value: 'full', description: 'Most complete rendered text' },
		],
		default: 'compact',
		displayOptions: { show: { text: [true] } },
		description: 'How much of the rendered page to return',
	},
];

export const simplifyField: INodeProperties = {
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	description:
		'Whether to return a simplified response. Turn this off to return the raw Exa response envelope.',
};
