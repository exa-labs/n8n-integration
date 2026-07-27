import type { INodeProperties } from 'n8n-workflow';

import * as get from './get.operation';

export { get };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['answer'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get an answer',
				description: 'Get a web-grounded answer with citations',
			},
		],
		default: 'get',
	},
	...get.description,
];
