import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { simplifyField } from '../common.descriptions';
import { parseJsonParameter } from '../../helpers/utils';
import { apiRequest } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		required: true,
		placeholder: 'e.g. What did Exa announce most recently?',
		description: 'Question to answer using live web sources',
	},
	{
		displayName: 'Output Format',
		name: 'outputFormat',
		type: 'options',
		default: 'text',
		options: [
			{ name: 'Text', value: 'text', description: 'Natural-language answer with citations' },
			{
				name: 'Structured (JSON Schema)',
				value: 'structured',
				description: 'JSON matching a schema you provide',
			},
		],
		description: 'Shape of the answer Exa returns',
	},
	{
		displayName: 'Output Schema',
		name: 'outputSchema',
		type: 'json',
		default:
			'{\n  "type": "object",\n  "properties": {\n    "answer": { "type": "string" }\n  },\n  "required": ["answer"]\n}',
		displayOptions: { show: { outputFormat: ['structured'] } },
		description: 'JSON Schema describing the answer object',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Include Full Text',
				name: 'text',
				type: 'boolean',
				default: false,
				description: 'Whether to include the full page text of each citation',
			},
		],
	},
	simplifyField,
];

export const description = updateDisplayOptions(
	{ show: { resource: ['answer'], operation: ['get'] } },
	properties,
);

export async function execute(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const body: IDataObject = { query: this.getNodeParameter('query', i) as string };

	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const outputFormat = this.getNodeParameter('outputFormat', i) as string;
	const simplify = this.getNodeParameter('simplify', i) as boolean;

	if (options.text) body.text = true;

	if (outputFormat === 'structured') {
		const schema = parseJsonParameter(
			this.getNode(),
			this.getNodeParameter('outputSchema', i) as string,
			'Output Schema',
			i,
		);
		body.outputSchema = { type: 'object', ...schema };
	}

	const response = await apiRequest.call(this, 'POST', '/answer', body);

	if (!simplify) {
		return [{ json: response, pairedItem: { item: i } }];
	}

	return [
		{
			json: { answer: response.answer, citations: response.citations ?? [] },
			pairedItem: { item: i },
		},
	];
}
