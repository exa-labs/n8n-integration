import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { monitorIdField } from './common.descriptions';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [monitorIdField];

export const description = updateDisplayOptions(
	{ show: { resource: ['monitor'], operation: ['delete'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const monitorId = this.getNodeParameter('monitorId', i) as string;
	const monitor: IDataObject = await apiRequest.call(
		this,
		'DELETE',
		`/monitors/${encodeURIComponent(monitorId)}`,
	);
	return [{ json: monitor, pairedItem: { item: i } }];
}
