import type { IDataObject } from 'n8n-workflow';

export type ExaResource = 'search' | 'contents' | 'answer' | 'agent';

export interface ExaContentStatus {
	id: string;
	status: string;
	source?: string;
	error?: IDataObject;
}

export interface ExaSearchResponse extends IDataObject {
	requestId?: string;
	results?: IDataObject[];
	statuses?: ExaContentStatus[];
	output?: IDataObject;
	costDollars?: IDataObject;
}

export interface ExaAgentRunEvent extends IDataObject {
	id?: string;
	event?: string;
	data?: IDataObject;
	createdAt?: string;
}

export interface ExaAgentRun extends IDataObject {
	id: string;
	status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
	stopReason?: string | null;
	output?: IDataObject;
}

export const AGENT_TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

export const AGENT_TERMINAL_EVENTS = [
	'agent_run.completed',
	'agent_run.failed',
	'agent_run.cancelled',
];
