import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { contentsOptions, simplifyField } from '../common.descriptions';
import type { ExaSearchResponse } from '../../helpers/interfaces';
import type { ContentsUiOptions } from '../../helpers/utils';
import { buildContentsPayload, mergeContentStatuses, splitList } from '../../helpers/utils';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName: 'URLs',
		name: 'urls',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://exa.ai, https://n8n.io',
		description: 'Comma-separated URLs to fetch. Exa result IDs are also accepted.',
	},
	{
		displayName: 'Contents',
		name: 'contents',
		type: 'collection',
		placeholder: 'Add Content Option',
		default: { text: true },
		description: 'What to extract from each page',
		options: contentsOptions,
	},
	simplifyField,
];

export const description = updateDisplayOptions(
	{ show: { resource: ['contents'], operation: ['get'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const urls = splitList(this.getNodeParameter('urls', i) as string);
	if (!urls.length) {
		throw new NodeOperationError(this.getNode(), 'No URLs were provided', { itemIndex: i });
	}

	const contentsUi = this.getNodeParameter('contents', i, {}) as ContentsUiOptions;
	const simplify = this.getNodeParameter('simplify', i) as boolean;

	const body: IDataObject = { urls, ...buildContentsPayload(contentsUi) };

	const response = (await apiRequest.call(this, 'POST', '/contents', body)) as ExaSearchResponse;

	if (!simplify) {
		return [{ json: response, pairedItem: { item: i } }];
	}

	return mergeContentStatuses(response.results ?? [], response.statuses).map((result) => ({
		json: result,
		pairedItem: { item: i },
	}));
}
