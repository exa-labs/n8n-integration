import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { ExaV1 } from './v1/ExaV1.node';
import { ExaV2 } from './v2/ExaV2.node';

export class Exa extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Exa',
			name: 'exa',
			icon: 'file:logo.svg',
			group: ['transform'],
			description: 'Search the web, read pages and run research agents with Exa',
			defaultVersion: 2,
		};

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			1: new ExaV1(baseDescription),
			2: new ExaV2(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
