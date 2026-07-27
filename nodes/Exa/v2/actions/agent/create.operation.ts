import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep, updateDisplayOptions } from 'n8n-workflow';

import type { ExaAgentRun } from '../../helpers/interfaces';
import { AGENT_TERMINAL_EVENTS, AGENT_TERMINAL_STATUSES } from '../../helpers/interfaces';
import { parseJsonParameter } from '../../helpers/utils';
import { apiRequest, streamEvents } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		placeholder:
			'e.g. Find AI infrastructure companies that raised a Series A in the last 6 months and their CTOs',
		description: 'Task for the agent, written in natural language',
	},
	{
		displayName: 'Output Format',
		name: 'outputFormat',
		type: 'options',
		default: 'text',
		options: [
			{ name: 'Text', value: 'text', description: 'Natural-language report with citations' },
			{
				name: 'Structured (JSON Schema)',
				value: 'structured',
				description: 'Validated JSON matching a schema you provide',
			},
		],
		description: 'Shape of the run output',
	},
	{
		displayName: 'Output Schema',
		name: 'outputSchema',
		type: 'json',
		default:
			'{\n  "type": "object",\n  "properties": {\n    "companies": {\n      "type": "array",\n      "maxItems": 10,\n      "items": {\n        "type": "object",\n        "properties": {\n          "name": { "type": "string" },\n          "website": { "type": "string", "format": "uri" }\n        },\n        "required": ["name"]\n      }\n    }\n  },\n  "required": ["companies"]\n}',
		displayOptions: { show: { outputFormat: ['structured'] } },
		description:
			'JSON Schema for the structured output. Bound arrays with maxItems to keep cost predictable.',
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		description:
			'Whether to block until the run finishes. Turn this off to return the run ID immediately and poll it later with the Get operation.',
	},
	{
		displayName: 'Wait Mode',
		name: 'waitMode',
		type: 'options',
		default: 'stream',
		displayOptions: { show: { waitForCompletion: [true] } },
		options: [
			{
				name: 'Stream',
				value: 'stream',
				description: 'Hold one server-sent events connection open until the run finishes',
			},
			{ name: 'Poll', value: 'poll', description: 'Re-request the run on an interval' },
		],
		description: 'How to wait for the run',
	},
	{
		displayName: 'Poll Interval (Seconds)',
		name: 'pollInterval',
		type: 'number',
		default: 4,
		typeOptions: { minValue: 1, maxValue: 300 },
		displayOptions: { show: { waitForCompletion: [true], waitMode: ['poll'] } },
		description: 'How long to wait between run status checks',
	},
	{
		displayName: 'Include Events',
		name: 'includeEvents',
		type: 'boolean',
		default: false,
		displayOptions: { show: { waitForCompletion: [true], waitMode: ['stream'] } },
		description:
			'Whether to attach every streamed event to the output, next to the finished run',
	},
	{
		displayName: 'Timeout (Seconds)',
		name: 'timeout',
		type: 'number',
		default: 600,
		typeOptions: { minValue: 10, maxValue: 3600 },
		displayOptions: { show: { waitForCompletion: [true] } },
		description: 'How long to wait before giving up on the run',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Continue From Run ID',
				name: 'previousRunId',
				type: 'string',
				default: '',
				placeholder: 'e.g. agent_run_01j7x9v0m2n4p6q8r0s2t4v6w8',
				description: 'Completed run to continue from, so the agent keeps its earlier findings',
			},
			{
				displayName: 'Data Sources',
				name: 'dataSources',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Affiliate', value: 'affiliate' },
					{ name: 'Baselayer', value: 'baselayer' },
					{ name: 'Fiber', value: 'fiber' },
					{ name: 'Financial Datasets', value: 'financial_datasets' },
					{ name: 'Jinko', value: 'jinko' },
					{ name: 'Particle', value: 'particle' },
					{ name: 'Similarweb', value: 'similarweb' },
				],
				description: 'Exa Connect providers to make available to the run (max 5)',
			},
			{
				displayName: 'Effort',
				name: 'effort',
				type: 'options',
				default: 'auto',
				options: [
					{ name: 'Auto', value: 'auto' },
					{ name: 'Extra High', value: 'xhigh' },
					{ name: 'High', value: 'high' },
					{ name: 'Low', value: 'low' },
					{ name: 'Medium', value: 'medium' },
					{ name: 'Minimal', value: 'minimal' },
				],
				description: 'How much work the agent should put into the run',
			},
			{
				displayName: 'Input Data (JSON)',
				name: 'inputData',
				type: 'json',
				default: '',
				placeholder: 'e.g. [{"company":"Exa"}]',
				description: 'Array of records for the agent to research or enrich',
			},
			{
				displayName: 'Metadata (JSON)',
				name: 'metadata',
				type: 'json',
				default: '',
				placeholder: 'e.g. {"workflow":"lead-research"}',
				description: 'String key/value pairs stored alongside the run',
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Behaviour guidance such as source preferences or exclusion rules',
			},
		],
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['agent'], operation: ['create'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const body: IDataObject = { query: this.getNodeParameter('query', i) as string };
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const outputFormat = this.getNodeParameter('outputFormat', i) as string;

	if (outputFormat === 'structured') {
		body.outputSchema = parseJsonParameter(
			this.getNode(),
			this.getNodeParameter('outputSchema', i) as string,
			'Output Schema',
			i,
		);
	}

	if (options.systemPrompt) body.systemPrompt = options.systemPrompt;
	if (options.effort && options.effort !== 'auto') body.effort = options.effort;
	if (options.previousRunId) body.previousRunId = options.previousRunId;
	if (options.metadata) {
		body.metadata = parseJsonParameter(
			this.getNode(),
			options.metadata as string,
			'Metadata',
			i,
		);
	}
	if (options.inputData) {
		const data = parseJsonParameter(
			this.getNode(),
			options.inputData as string,
			'Input Data',
			i,
		) as unknown;
		if (!Array.isArray(data)) {
			throw new NodeOperationError(this.getNode(), 'Input Data must be a JSON array of objects', {
				itemIndex: i,
			});
		}
		body.input = { data };
	}
	const dataSources = (options.dataSources as string[]) ?? [];
	if (dataSources.length) {
		body.dataSources = dataSources.map((provider) => ({ provider }));
	}

	const waitForCompletion = this.getNodeParameter('waitForCompletion', i) as boolean;
	if (!waitForCompletion) {
		const run = (await apiRequest.call(this, 'POST', '/agent/runs', body)) as ExaAgentRun;
		return [{ json: run, pairedItem: { item: i } }];
	}

	const timeoutMs = (this.getNodeParameter('timeout', i) as number) * 1000;
	const waitMode = this.getNodeParameter('waitMode', i) as string;

	if (waitMode === 'stream') {
		const events = await streamEvents.call(this, '/agent/runs', {
			method: 'POST',
			body,
			timeoutMs,
			shouldStop: (event) => AGENT_TERMINAL_EVENTS.includes(event.event ?? ''),
		});

		const terminal = events.find((event) => AGENT_TERMINAL_EVENTS.includes(event.event ?? ''));
		if (!terminal) {
			throw new NodeApiError(
				this.getNode(),
				{ message: 'The event stream ended before the run finished' },
				{
					message: 'The Exa event stream ended before the agent run finished',
					description:
						'Increase Timeout, or turn off Wait for Completion and follow the run with a Get operation.',
					itemIndex: i,
				},
			);
		}

		const run = terminal.data as ExaAgentRun;
		const includeEvents = this.getNodeParameter('includeEvents', i, false) as boolean;
		return [
			{ json: includeEvents ? { ...run, events } : run, pairedItem: { item: i } },
		];
	}

	const created = (await apiRequest.call(this, 'POST', '/agent/runs', body)) as ExaAgentRun;
	const pollIntervalMs = (this.getNodeParameter('pollInterval', i) as number) * 1000;
	const deadline = Date.now() + timeoutMs;

	let run = created;
	while (!AGENT_TERMINAL_STATUSES.includes(run.status)) {
		if (Date.now() > deadline) {
			throw new NodeApiError(
				this.getNode(),
				{ message: 'Timed out' },
				{
					message: `Agent run ${run.id} did not finish within the timeout`,
					description: 'Increase Timeout, or turn off Wait for Completion and poll with a Get operation.',
					itemIndex: i,
				},
			);
		}
		await sleep(pollIntervalMs);
		run = (await apiRequest.call(this, 'GET', `/agent/runs/${run.id}`)) as ExaAgentRun;
	}

	return [{ json: run, pairedItem: { item: i } }];
}
