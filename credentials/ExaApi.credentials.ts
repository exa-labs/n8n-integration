import {
	IAuthenticateGeneric,
	ICredentialType,
	IHttpRequestMethods,
	INodeProperties,
} from 'n8n-workflow';

export class ExaApi implements ICredentialType {
	name = 'exaApi';
	displayName = 'Exa API';
	documentationUrl = 'https://docs.exa.ai/reference/getting-started';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Your Exa API key. Get one at https://dashboard.exa.ai/api-keys',
		},
	];

	authenticate = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	} as IAuthenticateGeneric;

	test = {
		request: {
			baseURL: 'https://api.exa.ai',
			method: 'POST' as IHttpRequestMethods,
			url: '/search',
			json: true,
			body: {
				query: 'n8n credential verification',
				numResults: 1,
			},
		},
	};
}
