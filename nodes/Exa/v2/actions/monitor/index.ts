import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as deleteMonitor from './delete.operation';
import * as get from './get.operation';
import * as getMany from './getMany.operation';
import * as getRun from './getRun.operation';
import * as getRuns from './getRuns.operation';
import * as trigger from './trigger.operation';
import * as update from './update.operation';

export { create, deleteMonitor, get, getMany, getRun, getRuns, trigger, update };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['monitor'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a monitor',
				description: 'Run a search on a schedule and deliver new results to a webhook',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a monitor',
				description: 'Delete a monitor and stop its runs',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a monitor',
				description: 'Retrieve a monitor’s configuration and status',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many monitors',
				description: 'List monitors',
			},
			{
				name: 'Get Run',
				value: 'getRun',
				action: 'Get a monitor run',
				description: 'Retrieve one run and its output',
			},
			{
				name: 'Get Runs',
				value: 'getRuns',
				action: 'Get monitor runs',
				description: 'List a monitor’s runs, newest first',
			},
			{
				name: 'Trigger',
				value: 'trigger',
				action: 'Trigger a monitor run',
				description: 'Start a run now, outside the schedule',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a monitor',
				description: 'Change, pause or resume a monitor',
			},
		],
		default: 'create',
	},
	...create.description,
	...deleteMonitor.description,
	...get.description,
	...getMany.description,
	...getRun.description,
	...getRuns.description,
	...trigger.description,
	...update.description,
];
