import type { INodeProperties } from 'n8n-workflow';

import * as cancel from './cancel.operation';
import * as create from './create.operation';
import * as get from './get.operation';
import * as getEvents from './getEvents.operation';
import * as getMany from './getMany.operation';

export { cancel, create, get, getEvents, getMany };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['agent'] } },
		options: [
			{
				name: 'Cancel Run',
				value: 'cancel',
				action: 'Cancel an agent run',
				description: 'Stop a queued or running agent run',
			},
			{
				name: 'Create Run',
				value: 'create',
				action: 'Create an agent run',
				description: 'Start a multi-step research, list building or enrichment run',
			},
			{
				name: 'Get Many Runs',
				value: 'getMany',
				action: 'Get many agent runs',
				description: 'List recent agent runs',
			},
			{
				name: 'Get Run',
				value: 'get',
				action: 'Get an agent run',
				description: 'Retrieve the status and output of a run',
			},
			{
				name: 'Get Run Events',
				value: 'getEvents',
				action: 'Get agent run events',
				description: 'List or stream the events emitted by a run',
			},
		],
		default: 'create',
	},
	...cancel.description,
	...create.description,
	...get.description,
	...getEvents.description,
	...getMany.description,
];
