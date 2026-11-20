import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { paginationFields } from './common.descriptions';
import { getAllPages } from '../../transport';

const properties: INodeProperties[] = [
	...paginationFields,
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Only monitors with this name',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'active',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Disabled', value: 'disabled' },
					{ name: 'Paused', value: 'paused' },
				],
				description: 'Only monitors in this status',
			},
		],
	},
];

export const description = updateDisplayOptions(
	{ show: { resource: ['monitor'], operation: ['getMany'] } },
	properties,
);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
	const qs: IDataObject = {};
	if (filters.name) qs.name = filters.name;
	if (filters.status) qs.status = filters.status;
	const monitors: IDataObject[] = await getAllPages.call(this, '/monitors', limit, qs);
	return monitors.map((monitor) => ({ json: monitor, pairedItem: { item: i } }));
}
