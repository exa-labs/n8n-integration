import type { INodeProperties } from 'n8n-workflow';

import * as get from './get.operation';

export { get };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contents'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get page contents',
				description: 'Fetch cleaned text, highlights or summaries for URLs',
			},
		],
		default: 'get',
	},
	...get.description,
];
