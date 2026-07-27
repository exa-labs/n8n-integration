import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { runIdField } from './common.descriptions';
import { AGENT_TERMINAL_EVENTS } from '../../helpers/interfaces';
import { apiRequest, streamEvents } from '../../transport';

const properties: INodeProperties[] = [
	runIdField,
	{
		displayName: 'Stream',
		name: 'stream',
		type: 'boolean',
		default: false,
		description:
			'Whether to hold a server-sent events connection open and collect events until the run reaches a terminal state',
	},
	{
		displayName: 'Timeout (Seconds)',
		name: 'timeout',
		type: 'number',
		default: 600,
		typeOptions: { minValue: 10, maxValue: 3600 },
		displayOptions: { show: { stream: [true] } },
		description: 'How long to keep the stream open before giving up',
	},
	{
		displayName: 'After Event ID',
		name: 'lastEventId',
		type: 'string',
		default: '',
		displayOptions: { show: { stream: [true] } },
		description: 'Replay only events created after this event ID',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		displayOptions: { show: { stream: [false] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { stream: [false], returnAll: [false] } },
		description: 'Max number of results to return',
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['agent'], operation: ['getEvents'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const runId = this.getNodeParameter('runId', i) as string;
	const stream = this.getNodeParameter('stream', i) as boolean;

	if (stream) {
		const lastEventId = this.getNodeParameter('lastEventId', i, '') as string;
		const events = await streamEvents.call(this, `/agent/runs/${runId}/events`, {
			timeoutMs: (this.getNodeParameter('timeout', i) as number) * 1000,
			headers: lastEventId ? { 'Last-Event-ID': lastEventId } : {},
			shouldStop: (event) => AGENT_TERMINAL_EVENTS.includes(event.event ?? ''),
		});
		return events.map((event) => ({ json: event, pairedItem: { item: i } }));
	}

	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);

	const events: IDataObject[] = [];
	let cursor: string | undefined;

	do {
		const qs: IDataObject = { limit: Math.min(100, limit - events.length) };
		if (cursor) qs.cursor = cursor;

		const response = await apiRequest.call(this, 'GET', `/agent/runs/${runId}/events`, {}, qs);
		events.push(...((response.data as IDataObject[]) ?? []));
		cursor = response.hasMore ? (response.nextCursor as string) : undefined;
	} while (cursor && events.length < limit);

	return events
		.slice(0, returnAll ? undefined : limit)
		.map((event) => ({ json: event, pairedItem: { item: i } }));
}
