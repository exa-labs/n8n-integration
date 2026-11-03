/**
 * Waiting on an Exa agent run without losing it.
 *
 * A run keeps going (and billing) on Exa's side whatever happens to the n8n
 * execution waiting on it. Every way the wait can end early (timeout, dropped
 * stream, failing reads) therefore reports the run ID, so the workflow can
 * collect the run later instead of starting a second one.
 */
import type { IDataObject } from 'n8n-workflow';

import type { ExaAgentRun, ExaAgentRunEvent } from './interfaces';
import { AGENT_TERMINAL_STATUSES } from './interfaces';

/** The run ID announced by the first event that carries one (`agent_run.created`). */
export function runIdFromEvents(events: ExaAgentRunEvent[]): string | undefined {
	for (const event of events) {
		const id = (event.data as IDataObject | undefined)?.id;
		if (typeof id === 'string' && id.startsWith('agent_run_')) return id;
	}
	return undefined;
}

/** Raised when the wait budget runs out while the run is still going. */
export class AgentRunWaitTimeout extends Error {
	constructor(
		readonly runId: string,
		readonly waitedSeconds: number,
	) {
		super(
			`Agent run ${runId} was still running after ${waitedSeconds}s. It has not been cancelled: collect it with the Get Run operation and this ID instead of creating another run.`,
		);
		this.name = 'AgentRunWaitTimeout';
	}
}

export interface PollRunOptions {
	runId: string;
	/** Epoch ms after which the wait gives up. */
	deadline: number;
	intervalMs: number;
	/** Epoch ms when the wait started, for the timeout message. */
	startedAt: number;
	fetchRun: (runId: string, deadline: number) => Promise<ExaAgentRun>;
	sleep: (ms: number) => Promise<void>;
	now?: () => number;
	initial?: ExaAgentRun;
}

/** Re-reads a run every `intervalMs` until it reaches a terminal status or the deadline passes. */
export async function pollRun({
	runId,
	deadline,
	intervalMs,
	startedAt,
	fetchRun,
	sleep,
	now = Date.now,
	initial,
}: PollRunOptions): Promise<ExaAgentRun> {
	let run = initial ?? (await fetchRun(runId, deadline));
	while (!AGENT_TERMINAL_STATUSES.includes(run.status)) {
		if (now() + intervalMs > deadline) {
			throw new AgentRunWaitTimeout(runId, Math.round((now() - startedAt) / 1000));
		}
		await sleep(intervalMs);
		run = await fetchRun(runId, deadline);
	}
	return run;
}
