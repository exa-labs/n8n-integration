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
	{ show: { resource: ['monitor'], operation: ['trigger'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const monitorId = this.getNodeParameter('monitorId', i) as string;
	const response: IDataObject = await apiRequest.call(
		this,
		'POST',
		`/monitors/${encodeURIComponent(monitorId)}/trigger`,
	);
	return [{ json: { monitorId, ...response }, pairedItem: { item: i } }];
}
