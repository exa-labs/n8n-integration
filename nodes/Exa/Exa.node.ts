import { INodeType, INodeTypeDescription } from 'n8n-workflow';
import packageJson from '../../package.json';

export class Exa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Exa',
		name: 'exa',
		icon: 'file:logo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Semantic web search and research via Exa API',
		defaults: {
			name: 'Exa',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'exaApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.exa.ai',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'x-exa-integration': 'n8n',
				'User-Agent': `exa-n8n ${packageJson.version}`,
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
			options: [
				{
					name: 'Answer',
					value: 'answer',
					description: 'Get an AI-generated answer to a query',
				},
				{
					name: 'Content',
					value: 'contents',
					description: 'Get contents from URLs',
				},
				{
					name: 'Find Similar',
					value: 'findSimilar',
					description: 'Find similar links to a given URL',
				},
				{
					name: 'Research',
					value: 'research',
					description: 'Create and manage asynchronous research tasks',
				},
				{
					name: 'Search',
					value: 'search',
					description: 'Search the web intelligently',
				},
			],
			default: 'search',
		},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['search'],
					},
				},
				options: [
					{
						name: 'Search',
						value: 'search',
						action: 'Search the web',
						description: 'Search the web and optionally extract contents',
						routing: {
							request: {
								method: 'POST',
								url: '/search',
							},
						},
					},
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['contents'],
					},
				},
				options: [
					{
						name: 'Get Contents',
						value: 'getContents',
						action: 'Get contents from ur ls',
						description: 'Retrieve contents from a list of URLs',
						routing: {
							request: {
								method: 'POST',
								url: '/contents',
							},
						},
					},
				],
				default: 'getContents',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['findSimilar'],
					},
				},
				options: [
					{
						name: 'Find Similar Links',
						value: 'findSimilar',
						action: 'Find similar links',
						description: 'Find links similar to a given URL',
						routing: {
							request: {
								method: 'POST',
								url: '/findSimilar',
							},
						},
					},
				],
				default: 'findSimilar',
			},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['answer'],
				},
			},
			options: [
				{
					name: 'Get Answer',
					value: 'getAnswer',
					action: 'Get an AI answer',
					description: 'Get an AI-generated answer to a query',
					routing: {
						request: {
							method: 'POST',
							url: '/answer',
						},
					},
				},
			],
			default: 'getAnswer',
		},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['research'],
				},
			},
			options: [
				{
					name: 'Create Task',
					value: 'createTask',
					action: 'Create a research task',
					description: 'Create an asynchronous research task',
					routing: {
						request: {
							method: 'POST',
							url: '/research/v1',
						},
					},
				},
				{
					name: 'Get Task',
					value: 'getTask',
					action: 'Get a research task',
					description: 'Retrieve status and results of a research task',
					routing: {
						request: {
							method: 'GET',
							url: '=/research/v1/{{ $parameter.researchId }}',
						},
					},
				},
				{
					name: 'List Tasks',
					value: 'listTasks',
					action: 'List research tasks',
					description: 'Retrieve a paginated list of research tasks',
					routing: {
						request: {
							method: 'GET',
							url: '/research/v1',
						},
					},
				},
			],
			default: 'createTask',
		},
		{
			displayName: 'Query',
			name: 'query',
			type: 'string',
			required: true,
			displayOptions: {
				show: {
					resource: ['search', 'answer'],
				},
			},
			default: '',
			description: 'The search query',
			routing: {
				request: {
					body: {
						query: '={{ $value }}',
					},
				},
			},
		},
		{
			displayName: 'Instructions',
			name: 'instructions',
			type: 'string',
			required: true,
			displayOptions: {
				show: {
					resource: ['research'],
					operation: ['createTask'],
				},
			},
			default: '',
			description: 'Instructions for what you would like research on',
			typeOptions: {
				rows: 4,
			},
			routing: {
				request: {
					body: {
						instructions: '={{ $value }}',
					},
				},
			},
		},
		{
			displayName: 'Research ID',
			name: 'researchId',
			type: 'string',
			required: true,
			displayOptions: {
				show: {
					resource: ['research'],
					operation: ['getTask'],
				},
			},
			default: '',
			description: 'The unique identifier of the research request to retrieve',
		},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['findSimilar'],
					},
				},
				default: '',
				description: 'The URL to find similar links for',
				routing: {
					request: {
						body: {
							url: '={{ $value }}',
						},
					},
				},
			},
			{
				displayName: 'URLs',
				name: 'urls',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['contents'],
					},
				},
				default: '',
				description: 'Comma-separated list of URLs or IDs to get contents for',
				routing: {
					send: {
						preSend: [
							async function (this, requestOptions) {
								const urls = this.getNodeParameter('urls', 0) as string;
								const urlArray = urls.split(',').map((url) => url.trim());
								requestOptions.body = {
									...(requestOptions.body as object),
									ids: urlArray,
								};
								return requestOptions;
							},
						],
					},
				},
			},
			{
				displayName: 'Search Type',
				name: 'type',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['search'],
					},
				},
				options: [
					{
						name: 'Auto',
						value: 'auto',
						description: 'Intelligently combines neural and keyword search',
					},
					{
						name: 'Neural',
						value: 'neural',
						description: 'Embeddings-based semantic search',
					},
					{
						name: 'Keyword',
						value: 'keyword',
						description: 'Traditional keyword-based search',
					},
					{
						name: 'Fast',
						value: 'fast',
						description: 'Streamlined versions of neural and keyword',
					},
				],
				default: 'auto',
				routing: {
					request: {
						body: {
							type: '={{ $value }}',
						},
					},
				},
			},
			{
				displayName: 'Number of Results',
				name: 'numResults',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['search', 'findSimilar'],
					},
				},
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 10,
				description: 'Number of results to return (max 100 for neural, 10 for keyword)',
				routing: {
					request: {
						body: {
							numResults: '={{ $value }}',
						},
					},
				},
			},
		{
			displayName: 'Additional Options',
			name: 'additionalOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: {
				show: {
					resource: ['research'],
					operation: ['createTask'],
				},
			},
			options: [
				{
					displayName: 'Model',
					name: 'model',
					type: 'options',
					options: [
						{
							name: 'Exa Research',
							value: 'exa-research',
							description: 'Faster and cheaper',
						},
						{
							name: 'Exa Research Pro',
							value: 'exa-research-pro',
							description: 'More thorough analysis and stronger reasoning',
						},
					],
					default: 'exa-research',
					description: 'Research model to use',
					routing: {
						request: {
							body: {
								model: '={{ $value }}',
							},
						},
					},
				},
				{
					displayName: 'Output Schema',
					name: 'outputSchema',
					type: 'json',
					default: '',
					description: 'JSON Schema to enforce structured output',
					routing: {
						request: {
							body: {
								outputSchema: '={{ JSON.parse($value) }}',
							},
						},
					},
				},
			],
		},
		{
			displayName: 'Query Options',
			name: 'queryOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: {
				show: {
					resource: ['research'],
					operation: ['getTask'],
				},
			},
			options: [
				{
					displayName: 'Stream',
					name: 'stream',
					type: 'boolean',
					default: false,
					description: 'Whether to receive real-time updates via Server-Sent Events (SSE)',
					routing: {
						request: {
							qs: {
								stream: '={{ $value ? "true" : undefined }}',
							},
						},
					},
				},
				{
					displayName: 'Events',
					name: 'events',
					type: 'boolean',
					default: false,
					description: 'Whether to include the detailed event log of all operations performed',
					routing: {
						request: {
							qs: {
								events: '={{ $value ? "true" : undefined }}',
							},
						},
					},
				},
			],
		},
		{
			displayName: 'List Options',
			name: 'listOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: {
				show: {
					resource: ['research'],
					operation: ['listTasks'],
				},
			},
			options: [
				{
					displayName: 'Cursor',
					name: 'cursor',
					type: 'string',
					default: '',
					description: 'The cursor to paginate through the results',
					routing: {
						request: {
							qs: {
								cursor: '={{ $value }}',
							},
						},
					},
				},
				{
					displayName: 'Limit',
					name: 'limit',
					type: 'number',
					default: 50,
					typeOptions: {
						minValue: 1,
					},
					description: 'Max number of results to return',
					routing: {
						request: {
							qs: {
								limit: '={{ $value }}',
							},
						},
					},
				},
			],
		},
		{
			displayName: 'Additional Fields',
			name: 'additionalFields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: {
				show: {
					resource: ['search'],
				},
			},
		options: [
				{
					displayName: 'Category',
					name: 'category',
					type: 'options',
					options: [
						{ name: 'Company', value: 'company' },
						{ name: 'Financial Report', value: 'financial report' },
						{ name: 'GitHub', value: 'github' },
						{ name: 'LinkedIn Profile', value: 'linkedin profile' },
						{ name: 'News', value: 'news' },
						{ name: 'PDF', value: 'pdf' },
						{ name: 'Personal Site', value: 'personal site' },
						{ name: 'Research Paper', value: 'research paper' },
						{ name: 'Tweet', value: 'tweet' },
					],
					default: 'company',
					description: 'A data category to focus on',
					routing: {
						request: {
							body: {
								category: '={{ $value }}',
							},
						},
					},
				},
				{
					displayName: 'End Published Date',
					name: 'endPublishedDate',
					type: 'dateTime',
					default: '',
					description: 'Only return links published before this date',
					routing: {
						request: {
							body: {
								endPublishedDate: '={{ new Date($value).toISOString() }}',
							},
						},
					},
				},
				{
					displayName: 'Exclude Domains',
					name: 'excludeDomains',
					type: 'string',
					default: '',
					description: 'Comma-separated list of domains to exclude',
					routing: {
						send: {
							preSend: [
								async function (this, requestOptions) {
									const domains = this.getNodeParameter('additionalFields.excludeDomains', 0) as string;
									if (domains) {
										const domainArray = domains.split(',').map((d) => d.trim());
										requestOptions.body = {
											...(requestOptions.body as object),
											excludeDomains: domainArray,
										};
									}
									return requestOptions;
								},
							],
						},
					},
				},
				{
					displayName: 'Exclude Text',
					name: 'excludeText',
					type: 'string',
					default: '',
					description: 'Text that must not be present in webpage (comma-separated, max 5 words each)',
					routing: {
						send: {
							preSend: [
								async function (this, requestOptions) {
									const text = this.getNodeParameter('additionalFields.excludeText', 0) as string;
									if (text) {
										const textArray = text.split(',').map((t) => t.trim());
										requestOptions.body = {
											...(requestOptions.body as object),
											excludeText: textArray,
										};
									}
									return requestOptions;
								},
							],
						},
					},
				},
				{
					displayName: 'Include Domains',
					name: 'includeDomains',
					type: 'string',
					default: '',
					description: 'Comma-separated list of domains to include (e.g., arxiv.org, github.com)',
					routing: {
						send: {
							preSend: [
								async function (this, requestOptions) {
									const domains = this.getNodeParameter('additionalFields.includeDomains', 0) as string;
									if (domains) {
										const domainArray = domains.split(',').map((d) => d.trim());
										requestOptions.body = {
											...(requestOptions.body as object),
											includeDomains: domainArray,
										};
									}
									return requestOptions;
								},
							],
						},
					},
				},
				{
					displayName: 'Include Text',
					name: 'includeText',
					type: 'string',
					default: '',
					description: 'Text that must be present in webpage (comma-separated, max 5 words each)',
					routing: {
						send: {
							preSend: [
								async function (this, requestOptions) {
									const text = this.getNodeParameter('additionalFields.includeText', 0) as string;
									if (text) {
										const textArray = text.split(',').map((t) => t.trim());
										requestOptions.body = {
											...(requestOptions.body as object),
											includeText: textArray,
										};
									}
									return requestOptions;
								},
							],
						},
					},
				},
				{
					displayName: 'Start Published Date',
					name: 'startPublishedDate',
					type: 'dateTime',
					default: '',
					description: 'Only return links published after this date',
					routing: {
						request: {
							body: {
								startPublishedDate: '={{ new Date($value).toISOString() }}',
							},
						},
					},
				},
				{
					displayName: 'User Location',
					name: 'userLocation',
					type: 'string',
					default: '',
					description: 'Two-letter ISO country code (e.g., US, GB)',
					routing: {
						request: {
							body: {
								userLocation: '={{ $value }}',
							},
						},
					},
				},
			],
			},
			{
				displayName: 'Contents Options',
				name: 'contentsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['search', 'contents', 'findSimilar'],
					},
				},
				routing: {
					send: {
						preSend: [
							async function (this, requestOptions) {
								const contentsOptions = this.getNodeParameter('contentsOptions', 0, {}) as {
									text?: boolean;
									highlights?: boolean;
									summary?: boolean;
									livecrawl?: string;
									subpages?: number;
									imageLinks?: number;
								};

								const contents: Record<string, unknown> = {};

								if (contentsOptions.text !== undefined) {
									contents.text = contentsOptions.text;
								}
								if (contentsOptions.highlights !== undefined) {
									contents.highlights = contentsOptions.highlights;
								}
								if (contentsOptions.summary !== undefined) {
									contents.summary = contentsOptions.summary;
								}
								if (contentsOptions.livecrawl !== undefined) {
									contents.livecrawl = contentsOptions.livecrawl;
								}
								if (contentsOptions.subpages !== undefined && contentsOptions.subpages > 0) {
									contents.subpages = contentsOptions.subpages;
								}
								if (contentsOptions.imageLinks !== undefined && contentsOptions.imageLinks > 0) {
									contents.extras = { imageLinks: contentsOptions.imageLinks };
								}

								if (Object.keys(contents).length > 0) {
									requestOptions.body = {
										...(requestOptions.body as object),
										contents,
									};
								}

								return requestOptions;
							},
						],
					},
				},
				options: [
					{
						displayName: 'Highlights',
						name: 'highlights',
						type: 'boolean',
						default: false,
						description: 'Whether to include highlighted excerpts',
					},
					{
						displayName: 'Image Links',
						name: 'imageLinks',
						type: 'number',
						default: 0,
						typeOptions: {
							minValue: 0,
							maxValue: 10,
						},
						description: 'Number of image URLs to return per result (0-10)',
					},
					{
						displayName: 'Livecrawl',
						name: 'livecrawl',
						type: 'options',
						options: [
							{ name: 'Always', value: 'always' },
							{ name: 'Never', value: 'never' },
							{ name: 'Fallback', value: 'fallback' },
						],
						default: 'fallback',
						description: 'Whether to crawl the page in real-time',
					},
					{
						displayName: 'Subpages',
						name: 'subpages',
						type: 'number',
						default: 0,
						typeOptions: {
							minValue: 0,
							maxValue: 10,
						},
						description: 'Number of subpages to crawl (0-10)',
					},
					{
						displayName: 'Summary',
						name: 'summary',
						type: 'boolean',
						default: false,
						description: 'Whether to include an AI-generated summary',
					},
					{
						displayName: 'Text',
						name: 'text',
						type: 'boolean',
						default: false,
						description: 'Whether to include cleaned text from the page',
					},
				],
			},
		],
	};
}
