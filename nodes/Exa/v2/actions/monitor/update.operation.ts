import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import {
	customPeriodDescription,
	monitorIdField,
	scheduleOptions,
	webhookEventsField,
} from './common.descriptions';
import { buildMonitorTrigger } from '../../helpers/monitor';
import { parseJsonParameter, splitList } from '../../helpers/utils';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [
	monitorIdField,
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Custom Interval',
				name: 'customPeriod',
				type: 'string',
				default: '',
				placeholder: 'e.g. 3d',
				description: `${customPeriodDescription} Used when Schedule is Custom Interval`,
			},
			{
				displayName: 'Exclude Domains',
				name: 'excludeDomains',
				type: 'string',
				default: '',
				description: 'Comma-separated domains to exclude',
			},
			{
				displayName: 'Include Domains',
				name: 'includeDomains',
				type: 'string',
				default: '',
				description: 'Comma-separated domains to restrict results to',
			},
			{
				displayName: 'Metadata (JSON)',
				name: 'metadata',
				type: 'json',
				default: '',
				description: 'Replaces the monitor’s metadata',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Number of Results',
				name: 'numResults',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 1, maxValue: 100 },
			},
			{
				displayName: 'Output Schema (JSON)',
				name: 'outputSchema',
				type: 'json',
				default: '',
				description:
					'Replaces the output schema. Use {"type":"text"} to switch back to text output.',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Schedule',
				name: 'schedule',
				type: 'options',
				default: '1d',
				options: scheduleOptions,
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'paused',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Paused', value: 'paused', description: 'Stops all runs until resumed' },
				],
			},
			webhookEventsField,
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
			},
		],
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['monitor'], operation: ['update'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const monitorId = this.getNodeParameter('monitorId', i) as string;
	const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
	const body: IDataObject = {};

	if (fields.name !== undefined) body.name = fields.name;
	if (fields.status !== undefined) body.status = fields.status;
	if (fields.schedule !== undefined) {
		body.trigger = buildMonitorTrigger(fields.schedule as string, fields.customPeriod as string);
	}

	const search: IDataObject = {};
	if (fields.query) search.query = fields.query;
	if (fields.numResults !== undefined) search.numResults = fields.numResults;
	if (fields.includeDomains !== undefined)
		search.includeDomains = splitList(fields.includeDomains as string);
	if (fields.excludeDomains !== undefined)
		search.excludeDomains = splitList(fields.excludeDomains as string);
	if (Object.keys(search).length) body.search = search;

	const webhook: IDataObject = {};
	if (fields.webhookUrl) webhook.url = fields.webhookUrl;
	const events = (fields.webhookEvents as string[] | undefined) ?? [];
	if (events.length) webhook.events = events;
	if (Object.keys(webhook).length) body.webhook = webhook;

	if (fields.metadata) {
		body.metadata = parseJsonParameter(this.getNode(), fields.metadata as string, 'Metadata', i);
	}
	if (fields.outputSchema) {
		body.outputSchema = parseJsonParameter(
			this.getNode(),
			fields.outputSchema as string,
			'Output Schema',
			i,
		);
	}

	if (!Object.keys(body).length) {
		throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
			itemIndex: i,
		});
	}

	const monitor = await apiRequest.call(
		this,
		'PATCH',
		`/monitors/${encodeURIComponent(monitorId)}`,
		body,
	);
	return [{ json: monitor, pairedItem: { item: i } }];
}
