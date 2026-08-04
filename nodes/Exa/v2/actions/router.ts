import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import * as agent from './agent';
import * as answer from './answer';
import * as contents from './contents';
import * as search from './search';

type OperationExecute = (this: IExecuteFunctions, i: number) => Promise<INodeExecutionData[]>;

const operations: Record<string, Record<string, OperationExecute>> = {
	agent: {
		cancel: agent.cancel.execute,
		create: agent.create.execute,
		get: agent.get.execute,
		getEvents: agent.getEvents.execute,
		getMany: agent.getMany.execute,
	},
	answer: { get: answer.get.execute },
	contents: { get: contents.get.execute },
	search: { search: search.search.execute },
};

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;

	const execute = operations[resource]?.[operation];
	if (!execute) {
		throw new NodeOperationError(
			this.getNode(),
			`The operation "${operation}" is not supported for resource "${resource}"`,
		);
	}

	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			returnData.push(...(await execute.call(this, i)));
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: i },
				});
				continue;
			}
			if (error instanceof NodeApiError || error instanceof NodeOperationError) {
				const nodeError = error;
				throw nodeError;
			}
			throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
		}
	}

	return [returnData];
}
