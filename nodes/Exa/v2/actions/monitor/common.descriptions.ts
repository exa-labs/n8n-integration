import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { MONITOR_WEBHOOK_EVENTS } from '../../helpers/monitor';
import { contentsOptions } from '../common.descriptions';

export const monitorIdField: INodeProperties = {
	displayName: 'Monitor ID',
	name: 'monitorId',
	type: 'string',
	default: '',
	required: true,
	description: 'ID of the monitor',
};

export const scheduleOptions: INodePropertyOptions[] = [
	{ name: 'Every Hour', value: '1h' },
	{ name: 'Every 6 Hours', value: '6h' },
	{ name: 'Every 12 Hours', value: '12h' },
	{ name: 'Every Day', value: '1d' },
	{ name: 'Every Week', value: '7d' },
	{ name: 'Custom Interval', value: 'custom' },
	{ name: 'Manual Only', value: 'none', description: 'Runs only when triggered' },
];

export const customPeriodDescription =
	'Interval between runs, such as 2h, 3d or 2w. The minimum is 1h.';

/** Monitors take the same extraction options as search, except historical snapshots. */
export const monitorContentsOptions = contentsOptions.filter(
	(option) => option.name !== 'snapshotAsOf',
);

export const webhookEventsField: INodeProperties = {
	displayName: 'Webhook Events',
	name: 'webhookEvents',
	type: 'multiOptions',
	default: [],
	options: MONITOR_WEBHOOK_EVENTS,
	description: 'Events sent to the webhook. Leave empty for Exa’s default set.',
};

export const outputSchemaDefault =
	'{\n  "type": "object",\n  "properties": {\n    "events": {\n      "type": "array",\n      "items": {\n        "type": "object",\n        "properties": {\n          "title": { "type": "string" },\n          "url": { "type": "string" },\n          "summary": { "type": "string" }\n        }\n      }\n    }\n  },\n  "required": ["events"]\n}';

export const paginationFields: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { returnAll: [false] } },
		description: 'Max number of results to return',
	},
];
