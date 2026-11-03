import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import {
	customPeriodDescription,
	monitorContentsOptions,
	outputSchemaDefault,
	scheduleOptions,
	webhookEventsField,
} from './common.descriptions';
import { buildMonitorSearch, buildMonitorTrigger } from '../../helpers/monitor';
import type { ContentsUiOptions } from '../../helpers/utils';
import { parseJsonParameter } from '../../helpers/utils';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName:
			'To start a workflow from monitor results, use the Exa Trigger node instead: it creates the monitor and verifies every delivery for you.',
		name: 'triggerNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		required: true,
		placeholder: 'e.g. AI startups that raised a Series A',
		description: 'What the monitor searches for on every run',
	},
	{
		displayName: 'Schedule',
		name: 'schedule',
		type: 'options',
		default: '1d',
		options: scheduleOptions,
		description: 'How often the monitor runs',
	},
	{
		displayName: 'Custom Interval',
		name: 'customPeriod',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 3d',
		displayOptions: { show: { schedule: ['custom'] } },
		description: customPeriodDescription,
	},
	{
		displayName: 'Webhook URL',
		name: 'webhookUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/webhooks/exa',
		description:
			'Public HTTPS URL that receives run results. The response carries a webhookSecret, shown only once, for verifying deliveries.',
	},
	{
		displayName: 'Output Format',
		name: 'outputFormat',
		type: 'options',
		default: 'text',
		options: [
			{ name: 'Text', value: 'text', description: 'A written digest of what is new' },
			{
				name: 'Structured (JSON Schema)',
				value: 'structured',
				description: 'JSON matching a schema you provide',
			},
		],
		description: 'Shape of each run’s output',
	},
	{
		displayName: 'Output Schema',
		name: 'outputSchema',
		type: 'json',
		default: outputSchemaDefault,
		displayOptions: { show: { outputFormat: ['structured'] } },
		description: 'JSON Schema for each run’s output',
	},
	{
		displayName: 'Contents',
		name: 'contents',
		type: 'collection',
		placeholder: 'Add Content Option',
		default: { highlights: true },
		description: 'What to extract from each result page',
		options: monitorContentsOptions,
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Exclude Domains',
				name: 'excludeDomains',
				type: 'string',
				default: '',
				placeholder: 'e.g. reddit.com, pinterest.com',
				description: 'Comma-separated domains to exclude',
			},
			{
				displayName: 'Include Domains',
				name: 'includeDomains',
				type: 'string',
				default: '',
				placeholder: 'e.g. techcrunch.com, reuters.com',
				description: 'Comma-separated domains to restrict results to',
			},
			{
				displayName: 'Metadata (JSON)',
				name: 'metadata',
				type: 'json',
				default: '',
				placeholder: 'e.g. {"workflow":"funding-alerts"}',
				description: 'String key/value pairs stored with the monitor and sent with each run',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Display name for the monitor',
			},
			{
				displayName: 'Number of Results',
				name: 'numResults',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 1, maxValue: 100 },
				description: 'Results to consider on each run',
			},
			webhookEventsField,
		],
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['monitor'], operation: ['create'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const body: IDataObject = {
		search: buildMonitorSearch({
			query: this.getNodeParameter('query', i) as string,
			numResults: options.numResults as number | undefined,
			includeDomains: options.includeDomains as string | undefined,
			excludeDomains: options.excludeDomains as string | undefined,
			contents: this.getNodeParameter('contents', i, {}) as ContentsUiOptions,
		}),
		webhook: { url: this.getNodeParameter('webhookUrl', i) as string },
	};

	const trigger = buildMonitorTrigger(
		this.getNodeParameter('schedule', i) as string,
		this.getNodeParameter('customPeriod', i, '') as string,
	);
	if (trigger) body.trigger = trigger;

	const events = (options.webhookEvents as string[] | undefined) ?? [];
	if (events.length) (body.webhook as IDataObject).events = events;
	if (options.name) body.name = options.name;
	if (options.metadata) {
		body.metadata = parseJsonParameter(this.getNode(), options.metadata as string, 'Metadata', i);
	}
	if (this.getNodeParameter('outputFormat', i) === 'structured') {
		body.outputSchema = parseJsonParameter(
			this.getNode(),
			this.getNodeParameter('outputSchema', i) as string,
			'Output Schema',
			i,
		);
	}

	const monitor = await apiRequest.call(this, 'POST', '/monitors', body);
	return [{ json: monitor, pairedItem: { item: i } }];
}
