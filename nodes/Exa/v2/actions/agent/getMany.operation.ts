import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [
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

export const description = updateDisplayOptions(
	{ show: { resource: ['agent'], operation: ['getMany'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);

	const runs: IDataObject[] = [];
	let cursor: string | undefined;

	do {
		const pageSize = Math.min(100, limit - runs.length);
		const qs: IDataObject = { limit: pageSize };
		if (cursor) qs.cursor = cursor;

		const response = await apiRequest.call(this, 'GET', '/agent/runs', {}, qs);
		runs.push(...((response.data as IDataObject[]) ?? []));
		cursor = response.hasMore ? (response.nextCursor as string) : undefined;
	} while (cursor && runs.length < limit);

	return runs
		.slice(0, returnAll ? undefined : limit)
		.map((run) => ({ json: run, pairedItem: { item: i } }));
}
