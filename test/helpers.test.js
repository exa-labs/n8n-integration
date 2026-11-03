// Unit tests for the request builders, webhook verification and run-waiting
// logic. They run against the compiled output: `npm test` builds first.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { EventEmitter } = require('node:events');

const monitor = require('../dist/nodes/Exa/v2/helpers/monitor');
const utils = require('../dist/nodes/Exa/v2/helpers/utils');
const agentRun = require('../dist/nodes/Exa/v2/helpers/agentRun');
const transport = require('../dist/nodes/Exa/v2/transport');

const sign = (secret, t, body) =>
	`t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

test('verifyExaSignature accepts a valid signature over the raw body', () => {
	const body = '{"type":"monitor.run.completed"}';
	const now = 1_800_000_000;
	const result = monitor.verifyExaSignature({
		header: sign('s3cret', now, body),
		rawBody: Buffer.from(body),
		secret: 's3cret',
		nowSeconds: now + 10,
	});
	assert.deepEqual(result, { valid: true });
});

test('verifyExaSignature accepts any matching v1 signature in the header', () => {
	const body = '{}';
	const now = 1_800_000_000;
	const valid = sign('s3cret', now, body).split(',')[1];
	const result = monitor.verifyExaSignature({
		header: `t=${now},v1=${'0'.repeat(64)},${valid}`,
		rawBody: body,
		secret: 's3cret',
		nowSeconds: now,
	});
	assert.equal(result.valid, true);
});

test('verifyExaSignature rejects forged, stale, malformed and missing signatures', () => {
	const body = '{"a":1}';
	const now = 1_800_000_000;
	const check = (header, nowSeconds = now) =>
		monitor.verifyExaSignature({ header, rawBody: body, secret: 's3cret', nowSeconds });
	assert.deepEqual(check(sign('other', now, body)), { valid: false, reason: 'mismatch' });
	assert.deepEqual(check(sign('s3cret', now, '{"a":2}')), { valid: false, reason: 'mismatch' });
	assert.deepEqual(check(sign('s3cret', now, body), now + 301), { valid: false, reason: 'stale' });
	assert.deepEqual(check('t=abc,v1=zz'), { valid: false, reason: 'malformed-header' });
	assert.deepEqual(check(`t=${now}`), { valid: false, reason: 'malformed-header' });
	assert.deepEqual(check(undefined), { valid: false, reason: 'missing-header' });
});

test('buildMonitorTrigger maps schedules to interval triggers', () => {
	assert.deepEqual(monitor.buildMonitorTrigger('1d'), { type: 'interval', period: '1d' });
	assert.deepEqual(monitor.buildMonitorTrigger('custom', ' 3d '), {
		type: 'interval',
		period: '3d',
	});
	assert.equal(monitor.buildMonitorTrigger('none'), null);
	assert.equal(monitor.buildMonitorTrigger('custom', ''), null);
});

test('buildMonitorSearch leaves unset fields to Exa defaults', () => {
	assert.deepEqual(monitor.buildMonitorSearch({ query: 'q' }), { query: 'q' });
	assert.deepEqual(
		monitor.buildMonitorSearch({
			query: 'q',
			numResults: 5,
			includeDomains: 'a.com, b.com',
			contents: { highlights: true },
		}),
		{
			query: 'q',
			numResults: 5,
			includeDomains: ['a.com', 'b.com'],
			contents: { highlights: true },
		},
	);
});

test('buildContentsPayload passes snapshotAsOf through', () => {
	assert.deepEqual(
		utils.buildContentsPayload({ text: true, snapshotAsOf: '2026-06-01T00:00:00Z' }),
		{ text: true, snapshotAsOf: '2026-06-01T00:00:00Z' },
	);
});

test('isTransientError retries rate limits, server errors and dropped connections only', () => {
	for (const httpCode of ['429', '500', '502', '503', '504', 408]) {
		assert.equal(transport.isTransientError({ httpCode }), true, String(httpCode));
	}
	for (const httpCode of ['400', '401', '404', 422]) {
		assert.equal(transport.isTransientError({ httpCode }), false, String(httpCode));
	}
	assert.equal(transport.isTransientError({ cause: { code: 'ECONNRESET' } }), true);
	assert.equal(transport.isTransientError(new Error('boom')), false);
	assert.deepEqual([1, 2, 3, 10].map(transport.retryDelayMs), [1000, 2000, 4000, 30000]);
});

test('runIdFromEvents finds the run announced by the stream', () => {
	assert.equal(
		agentRun.runIdFromEvents([
			{ event: 'ping', data: {} },
			{ event: 'agent_run.created', data: { id: 'agent_run_123', status: 'queued' } },
		]),
		'agent_run_123',
	);
	assert.equal(agentRun.runIdFromEvents([{ data: { id: 'event_1' } }]), undefined);
});

test('pollRun returns the terminal run, including failed runs', async () => {
	const statuses = ['running', 'running', 'failed'];
	const run = await agentRun.pollRun({
		runId: 'agent_run_1',
		deadline: Date.now() + 60_000,
		startedAt: Date.now(),
		intervalMs: 1,
		fetchRun: async (id) => ({ id, status: statuses.shift() }),
		sleep: async () => {},
	});
	assert.equal(run.status, 'failed');
});

test('pollRun times out with the run ID instead of losing it', async () => {
	let now = 0;
	await assert.rejects(
		agentRun.pollRun({
			runId: 'agent_run_slow',
			deadline: 10_000,
			startedAt: 0,
			intervalMs: 4_000,
			now: () => now,
			fetchRun: async (id) => ({ id, status: 'running' }),
			sleep: async (ms) => {
				now += ms;
			},
		}),
		(error) =>
			error instanceof agentRun.AgentRunWaitTimeout && /agent_run_slow/.test(error.message),
	);
});

/** A fake execute context whose authenticated request is answered by `respond`. */
function fakeContext(respond) {
	return {
		getNode: () => ({ name: 'Exa', type: 'n8n-nodes-exa-official.exa', typeVersion: 2.1 }),
		helpers: { httpRequestWithAuthentication: async (_credential, options) => respond(options) },
	};
}

test('streamEvents keeps the events it saw when the wait times out', async () => {
	const stream = new EventEmitter();
	stream.destroy = () => {};
	const context = fakeContext(async () => ({ body: stream }));
	const pending = transport.streamEvents.call(context, '/agent/runs', {
		method: 'POST',
		timeoutMs: 50,
	});
	setImmediate(() =>
		stream.emit(
			'data',
			'event: agent_run.created\ndata: {"id":"agent_run_abc","status":"queued"}\n\n',
		),
	);
	const result = await pending;
	assert.equal(result.outcome, 'timeout');
	assert.equal(agentRun.runIdFromEvents(result.events), 'agent_run_abc');
});

test('streamEvents reports a stream that closes before the run ends', async () => {
	const stream = new EventEmitter();
	stream.destroy = () => {};
	const context = fakeContext(async () => ({ body: stream }));
	const pending = transport.streamEvents.call(context, '/agent/runs', { timeoutMs: 5_000 });
	setImmediate(() => stream.emit('end'));
	assert.equal((await pending).outcome, 'closed');
});

test('apiReadWithRetry retries transient failures and stops on client errors', async () => {
	let calls = 0;
	const flaky = fakeContext(async () => {
		calls++;
		if (calls === 1) throw Object.assign(new Error('unavailable'), { httpCode: '503' });
		return { id: 'agent_run_1', status: 'running' };
	});
	const run = await transport.apiReadWithRetry.call(
		flaky,
		'/agent/runs/agent_run_1',
		Date.now() + 10_000,
	);
	assert.equal(run.status, 'running');
	assert.equal(calls, 2);

	let notFoundCalls = 0;
	const missing = fakeContext(async () => {
		notFoundCalls++;
		throw Object.assign(new Error('not found'), { httpCode: '404' });
	});
	await assert.rejects(
		transport.apiReadWithRetry.call(missing, '/agent/runs/x', Date.now() + 10_000),
	);
	assert.equal(notFoundCalls, 1);
});
