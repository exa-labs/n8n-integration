import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { monitorIdField } from './common.descriptions';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [
	monitorIdField,
	{
		displayName: 'Run ID',
		name: 'monitorRunId',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the monitor run',
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['monitor'], operation: ['getRun'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const monitorId = this.getNodeParameter('monitorId', i) as string;
	const runId = this.getNodeParameter('monitorRunId', i) as string;
	const run: IDataObject = await apiRequest.call(
		this,
		'GET',
		`/monitors/${encodeURIComponent(monitorId)}/runs/${encodeURIComponent(runId)}`,
	);
	return [{ json: run, pairedItem: { item: i } }];
}
