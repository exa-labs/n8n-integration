/**
 * Exa Trigger: starts a workflow each time an Exa monitor finishes a run.
 *
 * Activating the workflow creates a monitor whose webhook is this node's URL
 * and keeps the monitor's one-time signing secret in the node's static data;
 * deactivating it deletes the monitor. Every delivery's `Exa-Signature` is
 * checked against that secret before the workflow starts.
 */
import { createHash } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	customPeriodDescription,
	monitorContentsOptions,
	outputSchemaDefault,
	scheduleOptions,
} from '../Exa/v2/actions/monitor/common.descriptions';
import {
	buildMonitorSearch,
	buildMonitorTrigger,
	verifyExaSignature,
} from '../Exa/v2/helpers/monitor';
import type { ContentsUiOptions } from '../Exa/v2/helpers/utils';
import { parseJsonParameter } from '../Exa/v2/helpers/utils';
import { apiRequest } from '../Exa/v2/transport';

const RUN_COMPLETED = 'monitor.run.completed';

interface TriggerState extends IDataObject {
	monitorId?: string;
	webhookSecret?: string;
	configHash?: string;
}

/** The monitor this node should own, derived from its parameters and webhook URL. */
function desiredMonitor(context: IHookFunctions): IDataObject {
	const options = context.getNodeParameter('options', {}) as IDataObject;
	const body: IDataObject = {
		search: buildMonitorSearch({
			query: context.getNodeParameter('query') as string,
			numResults: options.numResults as number | undefined,
			includeDomains: options.includeDomains as string | undefined,
			excludeDomains: options.excludeDomains as string | undefined,
			contents: context.getNodeParameter('contents', {}) as ContentsUiOptions,
		}),
		webhook: { url: context.getNodeWebhookUrl('default'), events: [RUN_COMPLETED] },
		name:
			(options.name as string | undefined) || `n8n: ${context.getWorkflow().name ?? 'workflow'}`,
	};
	const trigger = buildMonitorTrigger(
		context.getNodeParameter('schedule') as string,
		context.getNodeParameter('customPeriod', '') as string,
	);
	if (trigger) body.trigger = trigger;
	if (context.getNodeParameter('outputFormat') === 'structured') {
		body.outputSchema = parseJsonParameter(
			context.getNode(),
			context.getNodeParameter('outputSchema') as string,
			'Output Schema',
			0,
		);
	}
	if (options.metadata) {
		body.metadata = parseJsonParameter(
			context.getNode(),
			options.metadata as string,
			'Metadata',
			0,
		);
	}
	return body;
}

function hashOf(body: IDataObject): string {
	return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function isNotFound(error: unknown): boolean {
	return String((error as { httpCode?: string | number }).httpCode) === '404';
}

/** Sends a status without starting the workflow. */
function respond(
	context: IWebhookFunctions,
	status: number,
	message?: string,
): IWebhookResponseData {
	context
		.getResponseObject()
		.status(status)
		.json(message ? { error: message } : { received: true });
	return { noWebhookResponse: true };
}

export class ExaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Exa Trigger',
		name: 'exaTrigger',
		icon: 'file:logo.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["query"]}}',
		description: 'Starts the workflow when an Exa monitor finds new results',
		defaults: { name: 'Exa Trigger' },
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong -- the legacy rule predates NodeConnectionTypes
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'exaApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Activating the workflow creates an Exa monitor that delivers to this node; deactivating it deletes the monitor. Exa only delivers to public HTTPS URLs, so a local n8n needs WEBHOOK_URL set to a public tunnel.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				required: true,
				placeholder: 'e.g. AI startups that raised a Series A',
				description: 'What the monitor searches for on every run',
			},
			{
				displayName: 'Schedule',
				name: 'schedule',
				type: 'options',
				default: '1d',
				options: scheduleOptions.filter((option) => option.value !== 'none'),
				description: 'How often the monitor runs',
			},
			{
				displayName: 'Custom Interval',
				name: 'customPeriod',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. 3d',
				displayOptions: { show: { schedule: ['custom'] } },
				description: customPeriodDescription,
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				default: 'text',
				options: [
					{ name: 'Text', value: 'text', description: 'A written digest of what is new' },
					{
						name: 'Structured (JSON Schema)',
						value: 'structured',
						description: 'JSON matching a schema you provide',
					},
				],
				description: 'Shape of each run’s output',
			},
			{
				displayName: 'Output Schema',
				name: 'outputSchema',
				type: 'json',
				default: outputSchemaDefault,
				displayOptions: { show: { outputFormat: ['structured'] } },
				description: 'JSON Schema for each run’s output',
			},
			{
				displayName: 'Contents',
				name: 'contents',
				type: 'collection',
				placeholder: 'Add Content Option',
				default: { highlights: true },
				description: 'What to extract from each result page',
				options: monitorContentsOptions,
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Exclude Domains',
						name: 'excludeDomains',
						type: 'string',
						default: '',
						placeholder: 'e.g. reddit.com, pinterest.com',
						description: 'Comma-separated domains to exclude',
					},
					{
						displayName: 'Include Domains',
						name: 'includeDomains',
						type: 'string',
						default: '',
						placeholder: 'e.g. techcrunch.com, reuters.com',
						description: 'Comma-separated domains to restrict results to',
					},
					{
						displayName: 'Include Failed Runs',
						name: 'includeFailedRuns',
						type: 'boolean',
						default: false,
						description: 'Whether to also start the workflow for runs that failed',
					},
					{
						displayName: 'Metadata (JSON)',
						name: 'metadata',
						type: 'json',
						default: '',
						placeholder: 'e.g. {"team":"growth"}',
						description: 'String key/value pairs stored with the monitor and sent with each run',
					},
					{
						displayName: 'Monitor Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'Name shown in the Exa dashboard. Defaults to the workflow name.',
					},
					{
						displayName: 'Number of Results',
						name: 'numResults',
						type: 'number',
						default: 10,
						typeOptions: { minValue: 1, maxValue: 100 },
						description: 'Results to consider on each run',
					},
					{
						displayName: 'Run on Activation',
						name: 'runOnActivation',
						type: 'boolean',
						default: false,
						description:
							'Whether to start a run as soon as the workflow is activated instead of waiting for the first scheduled run',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const state = this.getWorkflowStaticData('node') as TriggerState;
				this.logger.debug('Exa Trigger: checking monitor', { monitorId: state.monitorId });
				if (!state.monitorId) return false;

				// Parameters or the webhook URL changed since the monitor was made: replace it.
				if (state.configHash !== hashOf(desiredMonitor(this))) {
					try {
						await apiRequest.call(
							this,
							'DELETE',
							`/monitors/${encodeURIComponent(state.monitorId)}`,
						);
					} catch (error) {
						if (!isNotFound(error)) throw error;
					}
					delete state.monitorId;
					delete state.webhookSecret;
					delete state.configHash;
					return false;
				}

				try {
					await apiRequest.call(this, 'GET', `/monitors/${encodeURIComponent(state.monitorId)}`);
					return true;
				} catch (error) {
					if (!isNotFound(error)) throw error;
					delete state.monitorId;
					delete state.webhookSecret;
					delete state.configHash;
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const state = this.getWorkflowStaticData('node') as TriggerState;
				const body = desiredMonitor(this);
				const monitor = await apiRequest.call(this, 'POST', '/monitors', body);
				state.monitorId = monitor.id as string;
				state.webhookSecret = monitor.webhookSecret as string;
				state.configHash = hashOf(body);
				this.logger.debug('Exa Trigger: created monitor', { monitorId: state.monitorId });

				const options = this.getNodeParameter('options', {}) as IDataObject;
				if (options.runOnActivation) {
					await apiRequest.call(
						this,
						'POST',
						`/monitors/${encodeURIComponent(state.monitorId)}/trigger`,
					);
				}
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const state = this.getWorkflowStaticData('node') as TriggerState;
				this.logger.debug('Exa Trigger: deleting monitor', { monitorId: state.monitorId });
				if (state.monitorId) {
					try {
						await apiRequest.call(
							this,
							'DELETE',
							`/monitors/${encodeURIComponent(state.monitorId)}`,
						);
					} catch (error) {
						if (!isNotFound(error)) throw error;
					}
				}
				delete state.monitorId;
				delete state.webhookSecret;
				delete state.configHash;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const state = this.getWorkflowStaticData('node') as TriggerState;
		if (!state.webhookSecret || !state.monitorId) {
			return respond(this, 401, 'This trigger has no monitor; reactivate the workflow');
		}

		const check = verifyExaSignature({
			header: this.getHeaderData()['exa-signature'] as string | undefined,
			rawBody: this.getRequestObject().rawBody ?? '',
			secret: state.webhookSecret,
		});
		if (!check.valid) return respond(this, 401, `Invalid Exa signature (${check.reason})`);

		const payload = this.getBodyData() as IDataObject;
		const run = (payload.data ?? {}) as IDataObject;
		// Acknowledge, without starting the workflow, anything that is not a finished run of this node's monitor.
		if (payload.type !== RUN_COMPLETED || run.monitorId !== state.monitorId)
			return respond(this, 200);

		const options = this.getNodeParameter('options', {}) as IDataObject;
		if (run.status !== 'completed' && !options.includeFailedRuns) return respond(this, 200);

		const { id: runId, ...rest } = run;
		return {
			workflowData: [
				this.helpers.returnJsonArray([
					{
						runId,
						...rest,
						eventId: payload.id,
						eventType: payload.type,
						eventCreatedAt: payload.createdAt,
					},
				]),
			],
		};
	}
}
