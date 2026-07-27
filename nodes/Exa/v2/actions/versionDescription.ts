import type { INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import * as agent from './agent';
import * as answer from './answer';
import * as contents from './contents';
import * as search from './search';

export const versionDescription: INodeTypeDescription = {
	displayName: 'Exa',
	name: 'exa',
	icon: 'file:logo.svg',
	group: ['transform'],
	version: 2,
	subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
	description: 'Search the web, read pages and run research agents with Exa',
	defaults: { name: 'Exa' },
	usableAsTool: true,
	inputs: [NodeConnectionTypes.Main],
	outputs: [NodeConnectionTypes.Main],
	credentials: [{ name: 'exaApi', required: true }],
	properties: [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [
				{
					name: 'Agent',
					value: 'agent',
					description: 'Run multi-step research, list building and enrichment',
				},
				{ name: 'Answer', value: 'answer', description: 'Answer a question from live sources' },
				{ name: 'Content', value: 'contents', description: 'Read the contents of URLs' },
				{ name: 'Search', value: 'search', description: 'Search the web' },
			],
			default: 'search',
		},
		...agent.description,
		...answer.description,
		...contents.description,
		...search.description,
	],
};
