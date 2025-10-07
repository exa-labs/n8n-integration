import { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class Exa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Exa',
		name: 'exa',
		icon: 'file:exa.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Exa API for intelligent web search and content extraction',
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
						name: 'Search',
						value: 'search',
						description: 'Search the web intelligently',
					},
					{
						name: 'Contents',
						value: 'contents',
						description: 'Get contents from URLs',
					},
					{
						name: 'Find Similar',
						value: 'findSimilar',
						description: 'Find similar links to a given URL',
					},
					{
						name: 'Answer',
						value: 'answer',
						description: 'Get an AI-generated answer to a query',
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
						action: 'Get contents from URLs',
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
							{ name: 'Research Paper', value: 'research paper' },
							{ name: 'News', value: 'news' },
							{ name: 'PDF', value: 'pdf' },
							{ name: 'GitHub', value: 'github' },
							{ name: 'Tweet', value: 'tweet' },
							{ name: 'Personal Site', value: 'personal site' },
							{ name: 'LinkedIn Profile', value: 'linkedin profile' },
							{ name: 'Financial Report', value: 'financial report' },
						],
						default: '',
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
				options: [
					{
						displayName: 'Text',
						name: 'text',
						type: 'boolean',
						default: false,
						description: 'Whether to include cleaned text from the page',
						routing: {
							request: {
								body: {
									text: '={{ $value }}',
								},
							},
						},
					},
					{
						displayName: 'Highlights',
						name: 'highlights',
						type: 'boolean',
						default: false,
						description: 'Whether to include highlighted excerpts',
						routing: {
							request: {
								body: {
									highlights: '={{ $value }}',
								},
							},
						},
					},
					{
						displayName: 'Summary',
						name: 'summary',
						type: 'boolean',
						default: false,
						description: 'Whether to include an AI-generated summary',
						routing: {
							request: {
								body: {
									summary: '={{ $value }}',
								},
							},
						},
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
						routing: {
							request: {
								body: {
									livecrawl: '={{ $value }}',
								},
							},
						},
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
						routing: {
							request: {
								body: {
									subpages: '={{ $value }}',
								},
							},
						},
					},
				],
			},
		],
	};
}
