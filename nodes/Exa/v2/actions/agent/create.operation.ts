import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep, updateDisplayOptions } from 'n8n-workflow';

import { AgentRunWaitTimeout, pollRun, runIdFromEvents } from '../../helpers/agentRun';
import type { ExaAgentRun } from '../../helpers/interfaces';
import { AGENT_TERMINAL_EVENTS } from '../../helpers/interfaces';
import { parseJsonParameter } from '../../helpers/utils';
import { apiReadWithRetry, apiRequest, streamEvents } from '../../transport';

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
		typeOptions: { minValue: 10, maxValue: 10800 },
		displayOptions: { show: { waitForCompletion: [true] } },
		description:
			'How long to wait before giving up. The run is not cancelled on timeout: the error names its ID so you can collect it with Get Run.',
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
					{
						name: 'Auto',
						value: 'auto',
						description: 'Metered by usage, capped by Max Cost (default $5)',
					},
					{ name: 'Extra High', value: 'xhigh', description: 'Fixed price per run' },
					{ name: 'High', value: 'high', description: 'Fixed price per run' },
					{ name: 'Low', value: 'low', description: 'Fixed price per run' },
					{ name: 'Medium', value: 'medium', description: 'Fixed price per run' },
					{ name: 'Minimal', value: 'minimal', description: 'Fixed price per run' },
					{
						name: 'Ultra',
						value: 'ultra',
						description:
							'Exhaustive research and large lists. Metered by usage, capped by Max Cost (default $20).',
					},
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
				displayName: 'Max Cost (Dollars)',
				name: 'maxCostDollars',
				type: 'number',
				default: 5,
				typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 2 },
				description:
					'Spend ceiling for the run. Only for the Auto and Ultra efforts; runs that finish early cost less.',
			},
			{
				displayName: 'Max Duration (Seconds)',
				name: 'maxDurationSeconds',
				type: 'number',
				default: 3600,
				typeOptions: { minValue: 300, maxValue: 10800 },
				description:
					'Soft wall-clock ceiling. Only for the Ultra effort; the run returns what it has when time runs out.',
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
	body.effort = (options.effort as string | undefined) ?? 'auto';
	const budget: IDataObject = {};
	if (options.maxCostDollars !== undefined) budget.maxCostDollars = options.maxCostDollars;
	if (options.maxDurationSeconds !== undefined) budget.maxDurationSeconds = options.maxDurationSeconds;
	if (Object.keys(budget).length) body.budget = budget;
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
	const startedAt = Date.now();
	const deadline = startedAt + timeoutMs;
	const fetchRun = async (runId: string, until: number) =>
		(await apiReadWithRetry.call(this, `/agent/runs/${runId}`, until)) as ExaAgentRun;
	const waitFor = async (runId: string, initial?: ExaAgentRun) => {
		try {
			return await pollRun({
				runId,
				deadline,
				startedAt,
				intervalMs: waitMode === 'poll' ? (this.getNodeParameter('pollInterval', i) as number) * 1000 : 4000,
				fetchRun,
				sleep,
				initial,
			});
		} catch (error) {
			throw runWaitError.call(this, error, runId, i);
		}
	};

	if (waitMode === 'stream') {
		const { events, outcome, error } = await streamEvents.call(this, '/agent/runs', {
			method: 'POST',
			body,
			timeoutMs,
			shouldStop: (event) => AGENT_TERMINAL_EVENTS.includes(event.event ?? ''),
		});
		const includeEvents = this.getNodeParameter('includeEvents', i, false) as boolean;
		const withEvents = (run: ExaAgentRun) => (includeEvents ? { ...run, events } : run);

		const terminal = events.find((event) => AGENT_TERMINAL_EVENTS.includes(event.event ?? ''));
		if (terminal) {
			return [{ json: withEvents(terminal.data as ExaAgentRun), pairedItem: { item: i } }];
		}

		const runId = runIdFromEvents(events);
		if (!runId) {
			throw new NodeApiError(
				this.getNode(),
				{ message: error?.message ?? 'No events received' },
				{
					message: 'The Exa event stream ended before it announced a run ID',
					description:
						'The run may still have been created. Check Get Many Runs before creating another one.',
					itemIndex: i,
				},
			);
		}
		if (outcome === 'timeout') {
			throw runWaitError.call(this, new AgentRunWaitTimeout(runId, timeoutMs / 1000), runId, i);
		}

		// The stream closed before the run finished (proxy or network). Follow the same run by polling.
		return [{ json: withEvents(await waitFor(runId)), pairedItem: { item: i } }];
	}

	const created = (await apiRequest.call(this, 'POST', '/agent/runs', body)) as ExaAgentRun;
	return [{ json: await waitFor(created.id, created), pairedItem: { item: i } }];
}

/** Turns a failed wait into a node error that always names the run to collect. */
function runWaitError(
	this: IExecuteFunctions,
	error: unknown,
	runId: string,
	itemIndex: number,
): Error {
	if (error instanceof AgentRunWaitTimeout) {
		return new NodeOperationError(this.getNode(), error.message, {
			itemIndex,
			description:
				'Increase Timeout, or turn off Wait for Completion and follow the run with Get Run.',
		});
	}
	const cause = error as Error;
	return new NodeOperationError(
		this.getNode(),
		`Lost track of agent run ${runId} while waiting for it: ${cause.message}`,
		{
			itemIndex,
			description: `The run was created and may still be running. Collect it with Get Run and ID ${runId} instead of creating another run.`,
		},
	);
}
