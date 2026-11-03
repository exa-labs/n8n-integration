import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { monitorIdField, paginationFields } from './common.descriptions';
import { getAllPages } from '../../transport';

const properties: INodeProperties[] = [monitorIdField, ...paginationFields];

export const description = updateDisplayOptions(
	{ show: { resource: ['monitor'], operation: ['getRuns'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const monitorId = this.getNodeParameter('monitorId', i) as string;
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
	const runs: IDataObject[] = await getAllPages.call(
		this,
		`/monitors/${encodeURIComponent(monitorId)}/runs`,
		limit,
	);
	return runs.map((run) => ({ json: run, pairedItem: { item: i } }));
}
