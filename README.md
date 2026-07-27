# n8n-nodes-exa-official

An n8n community node for the [Exa](https://exa.ai) API: web search, content extraction, and research agents. This node is usable both as a regular node and as a tool for an n8n AI Agent.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Search — `POST /search`

Semantic web search. Search types: `auto`, `instant`, `fast`, `deep-lite`, `deep`, `deep-reasoning`.

Output formats:

- **Results** — the ranked list of pages.
- **Text** — a single written answer synthesised from the results.
- **Structured (JSON Schema)** — JSON matching a schema you provide.

Options include category (`company`, `publication`, `news`, `personal site`, `financial report`, `people`), domain and text filters, published-date ranges, additional queries for the deep types, moderation, a system prompt and user location. Content extraction (text, highlights, summary, links, images, `maxAgeHours`, subpages) is available on every search.

### Contents — `POST /contents`

Fetch cleaned text, highlights, summaries, links and images for a list of URLs. Per-URL statuses are merged onto the results, so pages that failed to crawl arrive as items carrying `status` and `error` instead of silently disappearing.

### Answer — `POST /answer`

A grounded answer with citations, optionally as JSON matching a schema, optionally including the full text of each citation.

### Agent — `/agent/runs`

Multi-step research, list building and enrichment.

- **Create Run** — start a run, optionally waiting for it to finish by streaming server-sent events or by polling. Supports effort, system prompt, structured output, input rows, metadata, connector data sources and continuation from a previous run.
- **Get Run** — status and output of a run.
- **Get Many Runs** — recent runs, with pagination.
- **Get Run Events** — list a run's events, or hold an SSE connection open and collect them until the run finishes.
- **Cancel Run** — stop a queued or running run.

## Credentials

To use this node, you need an Exa API key. You can obtain one by:

1. Signing up at [dashboard.exa.ai](https://dashboard.exa.ai)
2. Navigating to the API Keys section
3. Creating a new API key

Add the API key to your n8n credentials as "Exa API".

## Compatibility

- Requires n8n 1.60.0 or newer, and Node.js 20.15 or newer.
- Tested against n8n 2.32.

## Usage

### As an AI Agent tool

Set the node's connection to an **AI Agent** and it appears as a tool. Any parameter can be filled by the model with `{{ $fromAI('query', 'what to search for', 'string') }}`, which makes Search and Answer useful as web-grounding tools for agents.

### Waiting for an agent run

**Wait for Completion** holds the workflow until the run reaches a terminal state:

- **Stream** keeps one server-sent events connection open and returns the finished run (optionally with every event that led to it).
- **Poll** re-requests the run on an interval.

For long runs, turn **Wait for Completion** off, store the returned `id`, and follow the run later with **Get Run** — the run keeps going server-side.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [Exa API documentation](https://docs.exa.ai)
* [Exa API reference](https://docs.exa.ai/reference/search)

## Development

To work on this node locally:

```bash
# Install dependencies
npm install

# Build the node
npm run build
npm run lint

# Install the node in your n8n instance
mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm init -y
npm install /path/to/n8n-integration
n8n start
```

## License

[MIT](https://github.com/exa-labs/n8n-integration/blob/main/LICENSE)
