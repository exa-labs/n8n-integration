import type { INodeProperties } from 'n8n-workflow';

import * as search from './search.operation';

export { search };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['search'] } },
		options: [
			{
				name: 'Search',
				value: 'search',
				action: 'Search the web',
				description: 'Search the web and optionally synthesize an answer or JSON',
			},
		],
		default: 'search',
	},
	...search.description,
];
