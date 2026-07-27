import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { runIdField } from './common.descriptions';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [runIdField];

export const description = updateDisplayOptions(
	{ show: { resource: ['agent'], operation: ['get'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const runId = this.getNodeParameter('runId', i) as string;
	const run = await apiRequest.call(this, 'GET', `/agent/runs/${runId}`);
	return [{ json: run, pairedItem: { item: i } }];
}
