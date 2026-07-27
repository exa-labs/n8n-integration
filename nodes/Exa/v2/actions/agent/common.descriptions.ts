import type { INodeProperties } from 'n8n-workflow';

export const runIdField: INodeProperties = {
	displayName: 'Run ID',
	name: 'runId',
	type: 'string',
	default: '',
	required: true,
	placeholder: 'e.g. agent_run_01j7x9v0m2n4p6q8r0s2t4v6w8',
	description: 'ID of the agent run',
};
