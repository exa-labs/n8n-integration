import type { INodeType, INodeTypeDescription, INodeTypeBaseDescription } from 'n8n-workflow';

import packageJson from '../../../package.json';

export class ExaV1 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
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
			// ── Resource selector ──────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Answer',
						value: 'answer',
						description: 'Get a web-grounded LLM answer to a query',
					},
					{
						name: 'Content',
						value: 'contents',
						description: 'Get contents from URLs',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search the web intelligently',
					},
				],
				default: 'search',
			},

			// ── Operations ─────────────────────────────────────────────────
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
						description:
							'Search the web and optionally extract contents',
						routing: {
							request: {
								method: 'POST',
								url: '/search',
							},
						},
					},
					{
						name: 'Deep Search',
						value: 'deepSearch',
						action: 'Deep search the web',
						description:
							'Run a deep or deep-reasoning search with synthesized output',
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
						action: 'Get contents from urls',
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
						resource: ['answer'],
					},
				},
				options: [
					{
						name: 'Get Answer',
						value: 'getAnswer',
						action: 'Get a web grounded LLM answer',
						description: 'Get a web-grounded LLM answer to a query',
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

			// ── Shared query field (search + answer) ───────────────────────
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

			// ── URLs field (contents) ──────────────────────────────────────
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
								const urls = this.getNodeParameter(
									'urls',
									0,
								) as string;
								const urlArray = urls
									.split(',')
									.map((url) => url.trim());
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

			// ── Deep Search Type (deep search operation only) ──────────────
			{
				displayName: 'Deep Search Type',
				name: 'deepSearchType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['deepSearch'],
					},
				},
				options: [
					{
						name: 'Deep',
						value: 'deep',
						description: 'Deep search with synthesized output (~5s)',
					},
					{
						name: 'Deep Lite',
						value: 'deep-lite',
						description:
							'Lightweight synthesized output with lower latency',
					},
					{
						name: 'Deep Max',
						value: 'deep-max',
						description: 'Highest-effort deep search mode',
					},
					{
						name: 'Deep Reasoning',
						value: 'deep-reasoning',
						description:
							'Deep search with stronger reasoning (~7s)',
					},
				],
				default: 'deep',
				description: 'The deep search variant to use',
				routing: {
					request: {
						body: {
							type: '={{ $value }}',
						},
					},
				},
			},

			// ── Output Format (deep search only) ───────────────────────────
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['deepSearch'],
					},
				},
				options: [
					{
						name: 'Text',
						value: 'text',
						description: 'Get synthesized text output (default)',
					},
					{
						name: 'Structured (JSON Schema)',
						value: 'structured',
						description:
							'Get structured object output matching a JSON Schema',
					},
				],
				default: 'text',
				description:
					'Choose between plain text or structured JSON output',
			},
			{
				displayName: 'Output Description',
				name: 'outputDescription',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['deepSearch'],
						outputFormat: ['text'],
					},
				},
				default: '',
				description:
					'Freeform description of the desired text output format',
				typeOptions: {
					rows: 3,
				},
				routing: {
					send: {
						preSend: [
							async function (this, requestOptions) {
								const desc = this.getNodeParameter(
									'outputDescription',
									0,
								) as string;
								if (desc) {
									requestOptions.body = {
										...(requestOptions.body as object),
										outputSchema: {
											type: 'text',
											description: desc,
										},
									};
								}
								return requestOptions;
							},
						],
					},
				},
			},
			{
				displayName: 'Output Schema',
				name: 'deepOutputSchema',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['deepSearch'],
						outputFormat: ['structured'],
					},
				},
				default: '',
				description:
					'JSON Schema defining the structure of the output object (provide properties/required, type:object is added automatically)',
				routing: {
					send: {
						preSend: [
							async function (this, requestOptions) {
								const raw = this.getNodeParameter(
									'deepOutputSchema',
									0,
								) as string;
								if (raw) {
									const parsed = JSON.parse(raw) as Record<
										string,
										unknown
									>;
									requestOptions.body = {
										...(requestOptions.body as object),
										outputSchema: {
											type: 'object',
											...parsed,
										},
									};
								}
								return requestOptions;
							},
						],
					},
				},
			},

			// ── Additional Queries (deep search only) ──────────────────────
			{
				displayName: 'Additional Queries',
				name: 'additionalQueries',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['deepSearch'],
					},
				},
				default: '',
				description:
					'Comma-separated query variations to improve deep search results',
				routing: {
					send: {
						preSend: [
							async function (this, requestOptions) {
								const queries = this.getNodeParameter(
									'additionalQueries',
									0,
								) as string;
								if (queries) {
									const queryArray = queries
										.split(',')
										.map((q) => q.trim());
									requestOptions.body = {
										...(requestOptions.body as object),
										additionalQueries: queryArray,
									};
								}
								return requestOptions;
							},
						],
					},
				},
			},

			// ── System Prompt (deep search only) ───────────────────────────
			{
				displayName: 'System Prompt',
				name: 'deepSystemPrompt',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['deepSearch'],
					},
				},
				default: '',
				description:
					'Instructions that guide synthesized output and search planning',
				typeOptions: {
					rows: 3,
				},
				routing: {
					request: {
						body: {
							systemPrompt: '={{ $value }}',
						},
					},
				},
			},

			// ── Search Type (regular search only) ──────────────────────────
			{
				displayName: 'Search Type',
				name: 'type',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['search'],
					},
				},
				options: [
					{
						name: 'Auto',
						value: 'auto',
						description:
							'Intelligently combines neural and other search methods',
					},
					{
						name: 'Fast',
						value: 'fast',
						description: 'Low-latency optimized search',
					},
					{
						name: 'Instant',
						value: 'instant',
						description:
							'Lowest latency embeddings-based search (~150ms)',
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

			// ── Number of Results (all search operations) ──────────────────
			{
				displayName: 'Number of Results',
				name: 'numResults',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['search'],
					},
				},
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 10,
				description: 'Number of results to return (max 100)',
				routing: {
					request: {
						body: {
							numResults: '={{ $value }}',
						},
					},
				},
			},

			// ── Additional Fields (regular search) ─────────────────────────
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['search'],
					},
				},
				options: [
					{
						displayName: 'Category',
						name: 'category',
						type: 'options',
						options: [
							{ name: 'Company', value: 'company' },
							{
								name: 'Financial Report',
								value: 'financial report',
							},
							{ name: 'News', value: 'news' },
							{ name: 'People', value: 'people' },
							{
								name: 'Personal Site',
								value: 'personal site',
							},
							{
								name: 'Research Paper',
								value: 'research paper',
							},
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
						description:
							'Only return links published before this date',
						routing: {
							request: {
								body: {
									endPublishedDate:
										'={{ new Date($value).toISOString() }}',
								},
							},
						},
					},
					{
						displayName: 'Exclude Domains',
						name: 'excludeDomains',
						type: 'string',
						default: '',
						description:
							'Comma-separated list of domains to exclude',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const domains = this.getNodeParameter(
											'additionalFields.excludeDomains',
											0,
										) as string;
										if (domains) {
											const domainArray = domains
												.split(',')
												.map((d) => d.trim());
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
						description:
							'Text that must not be present in webpage (comma-separated, max 5 words each)',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const text = this.getNodeParameter(
											'additionalFields.excludeText',
											0,
										) as string;
										if (text) {
											const textArray = text
												.split(',')
												.map((t) => t.trim());
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
						description:
							'Comma-separated list of domains to include (e.g., arxiv.org, github.com)',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const domains = this.getNodeParameter(
											'additionalFields.includeDomains',
											0,
										) as string;
										if (domains) {
											const domainArray = domains
												.split(',')
												.map((d) => d.trim());
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
						description:
							'Text that must be present in webpage (comma-separated, max 5 words each)',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const text = this.getNodeParameter(
											'additionalFields.includeText',
											0,
										) as string;
										if (text) {
											const textArray = text
												.split(',')
												.map((t) => t.trim());
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
						displayName: 'Moderation',
						name: 'moderation',
						type: 'boolean',
						default: false,
						description:
							'Whether to filter unsafe content from results',
						routing: {
							request: {
								body: {
									moderation: '={{ $value }}',
								},
							},
						},
					},
					{
						displayName: 'Output Schema',
						name: 'outputSchema',
						type: 'json',
						default: '',
						description:
							'JSON Schema to enforce structured output with grounded citations',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const schema = this.getNodeParameter(
											'additionalFields.outputSchema',
											0,
										) as string;
										if (schema) {
											requestOptions.body = {
												...(requestOptions.body as object),
												outputSchema:
													JSON.parse(schema),
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
						description:
							'Only return links published after this date',
						routing: {
							request: {
								body: {
									startPublishedDate:
										'={{ new Date($value).toISOString() }}',
								},
							},
						},
					},
					{
						displayName: 'System Prompt',
						name: 'systemPrompt',
						type: 'string',
						default: '',
						description:
							'Instructions that guide synthesized output when outputSchema is provided',
						typeOptions: {
							rows: 3,
						},
						routing: {
							request: {
								body: {
									systemPrompt: '={{ $value }}',
								},
							},
						},
					},
					{
						displayName: 'User Location',
						name: 'userLocation',
						type: 'string',
						default: '',
						description:
							'Two-letter ISO country code (e.g., US, GB)',
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

			// ── Additional Fields (deep search) ────────────────────────────
			{
				displayName: 'Additional Fields',
				name: 'deepAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['search'],
						operation: ['deepSearch'],
					},
				},
				options: [
					{
						displayName: 'Category',
						name: 'category',
						type: 'options',
						options: [
							{ name: 'Company', value: 'company' },
							{
								name: 'Financial Report',
								value: 'financial report',
							},
							{ name: 'News', value: 'news' },
							{ name: 'People', value: 'people' },
							{
								name: 'Personal Site',
								value: 'personal site',
							},
							{
								name: 'Research Paper',
								value: 'research paper',
							},
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
						displayName: 'Exclude Domains',
						name: 'excludeDomains',
						type: 'string',
						default: '',
						description:
							'Comma-separated list of domains to exclude',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const domains = this.getNodeParameter(
											'deepAdditionalFields.excludeDomains',
											0,
										) as string;
										if (domains) {
											const domainArray = domains
												.split(',')
												.map((d) => d.trim());
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
						displayName: 'Include Domains',
						name: 'includeDomains',
						type: 'string',
						default: '',
						description:
							'Comma-separated list of domains to include',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const domains = this.getNodeParameter(
											'deepAdditionalFields.includeDomains',
											0,
										) as string;
										if (domains) {
											const domainArray = domains
												.split(',')
												.map((d) => d.trim());
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
						displayName: 'Moderation',
						name: 'moderation',
						type: 'boolean',
						default: false,
						description:
							'Whether to filter unsafe content from results',
						routing: {
							request: {
								body: {
									moderation: '={{ $value }}',
								},
							},
						},
					},
					{
						displayName: 'User Location',
						name: 'userLocation',
						type: 'string',
						default: '',
						description:
							'Two-letter ISO country code (e.g., US, GB)',
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

			// ── Answer Options ──────────────────────────────────────────────
			{
				displayName: 'Additional Options',
				name: 'answerOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['answer'],
					},
				},
				options: [
					{
						displayName: 'Output Schema',
						name: 'outputSchema',
						type: 'json',
						default: '',
						description:
							'JSON Schema to enforce structured output',
						routing: {
							send: {
								preSend: [
									async function (this, requestOptions) {
										const schema = this.getNodeParameter(
											'answerOptions.outputSchema',
											0,
										) as string;
										if (schema) {
											requestOptions.body = {
												...(requestOptions.body as object),
												outputSchema:
													JSON.parse(schema),
											};
										}
										return requestOptions;
									},
								],
							},
						},
					},
					{
						displayName: 'System Prompt',
						name: 'systemPrompt',
						type: 'string',
						default: '',
						description:
							'Instructions that guide the answer generation',
						typeOptions: {
							rows: 3,
						},
						routing: {
							request: {
								body: {
									systemPrompt: '={{ $value }}',
								},
							},
						},
					},
				],
			},

			// ── Contents Options (search + contents resources) ─────────────
			{
				displayName: 'Contents Options',
				name: 'contentsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['search', 'contents'],
					},
				},
				routing: {
					send: {
						preSend: [
							async function (this, requestOptions) {
								const contentsOptions = this.getNodeParameter(
									'contentsOptions',
									0,
									{},
								) as {
									text?: boolean;
									textMaxCharacters?: number;
									highlights?: boolean;
									highlightsMaxCharacters?: number;
									summary?: boolean;
									livecrawl?: string;
									subpages?: number;
									imageLinks?: number;
								};

								// Default to highlights so results always include relevant excerpts
								const contents: Record<string, unknown> = {
									highlights: true,
								};

								if (contentsOptions.highlights === false) {
									delete contents.highlights;
								} else if (
									contentsOptions.highlightsMaxCharacters
								) {
									contents.highlights = {
										maxCharacters:
											contentsOptions.highlightsMaxCharacters,
									};
								}

								if (contentsOptions.text) {
									contents.text =
										contentsOptions.textMaxCharacters
											? {
													maxCharacters:
														contentsOptions.textMaxCharacters,
												}
											: true;
								}

								if (contentsOptions.summary) {
									contents.summary = true;
								}
								if (contentsOptions.livecrawl !== undefined) {
									contents.livecrawl =
										contentsOptions.livecrawl;
								}
								if (
									contentsOptions.subpages !== undefined &&
									contentsOptions.subpages > 0
								) {
									contents.subpages =
										contentsOptions.subpages;
								}
								if (
									contentsOptions.imageLinks !== undefined &&
									contentsOptions.imageLinks > 0
								) {
									contents.extras = {
										imageLinks: contentsOptions.imageLinks,
									};
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
						default: true,
						description:
							'Whether to include highlighted excerpts (enabled by default)',
					},
					{
						displayName: 'Highlights Max Characters',
						name: 'highlightsMaxCharacters',
						type: 'number',
						default: 0,
						typeOptions: {
							minValue: 0,
						},
						description:
							'Maximum character length for highlights (0 for no limit)',
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
						description:
							'Number of image URLs to return per result (0-10)',
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
						description:
							'Whether to crawl the page in real-time',
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
						description:
							'Whether to include an AI-generated summary',
					},
					{
						displayName: 'Text',
						name: 'text',
						type: 'boolean',
						default: false,
						description:
							'Whether to include full cleaned text from the page',
					},
					{
						displayName: 'Text Max Characters',
						name: 'textMaxCharacters',
						type: 'number',
						default: 0,
						typeOptions: {
							minValue: 0,
						},
						description:
							'Maximum character length for text content (0 for no limit)',
					},
				],
			},
		],
	};
	}
}
