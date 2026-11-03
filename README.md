# n8n-nodes-exa-official

An n8n community node for the [Exa](https://exa.ai) API: web search, content extraction, research agents and web monitors. The package has two nodes:

- **Exa** — every operation below. Usable both as a regular node and as a tool for an n8n AI Agent.
- **Exa Trigger** — starts a workflow each time an Exa monitor finds new results.

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

Options include category (`company`, `publication`, `news`, `personal site`, `financial report`, `people`), domain and text filters, published-date ranges, additional queries for the deep types, moderation, a system prompt and user location. Content extraction (text, highlights, summary, links, images, `maxAgeHours`, subpages, Snapshot As Of) is available on every search. New nodes (version 2.1) return highlights by default; workflows saved on version 2 keep returning metadata only.

### Contents — `POST /contents`

Fetch cleaned text, highlights, summaries, links and images for a list of URLs. **Snapshot As Of** returns each page as Exa stored it at a past date-time instead of the live page (it cannot be combined with Max Age). Per-URL statuses are merged onto the results, so pages that failed to crawl arrive as items carrying `status` and `error` instead of silently disappearing.

### Answer — `POST /answer`

A grounded answer with citations, optionally as JSON matching a schema, optionally including the full text of each citation.

### Agent — `/agent/runs`

Multi-step research, list building and enrichment.

- **Create Run** — start a run, optionally waiting for it to finish by streaming server-sent events or by polling. Supports every effort (Minimal to Extra High at a fixed price; Auto and Ultra metered and capped by **Max Cost**, Ultra also by **Max Duration**), system prompt, structured output, input rows, metadata, connector data sources and continuation from a previous run.
- **Get Run** — status and output of a run.
- **Get Many Runs** — recent runs, with pagination.
- **Get Run Events** — list a run's events, or hold an SSE connection open and collect them until the run finishes.
- **Cancel Run** — stop a queued or running run.

### Monitor — `/monitors`

A search that runs on a schedule and delivers new results to a webhook.

- **Create** — query, schedule (hourly to weekly, a custom interval, or manual only), webhook URL, text or structured output, contents and domain filters. The response carries a `webhookSecret` that Exa shows only once.
- **Get**, **Get Many**, **Update** (including pause and resume), **Delete**, **Trigger** (run now; the monitor must be active), **Get Runs** and **Get Run**.

### Exa Trigger

Activating the workflow creates a monitor whose webhook is the trigger's own URL; deactivating it deletes the monitor, and changing the trigger's settings replaces it. Each delivery's `Exa-Signature` is verified against the monitor's secret before the workflow starts, and each finished run becomes one item with its `output` (results, plus the text or structured digest). Exa delivers only to public HTTPS URLs, so a self-hosted n8n needs `WEBHOOK_URL` set to a public address.

## Credentials

To use this node, you need an Exa API key. You can obtain one by:

1. Signing up at [dashboard.exa.ai](https://dashboard.exa.ai)
2. Navigating to the API Keys section
3. Creating a new API key

Add the API key to your n8n credentials as "Exa API".

## Compatibility

- Requires n8n 1.60.0 or newer, and Node.js 20.15 or newer.
- Tested against n8n 2.45.7.

## Usage

### As an AI Agent tool

Set the node's connection to an **AI Agent** and it appears as a tool. Any parameter can be filled by the model with `{{ $fromAI('query', 'what to search for', 'string') }}`, which makes Search and Answer useful as web-grounding tools for agents.

### Waiting for an agent run

**Wait for Completion** holds the workflow until the run reaches a terminal state:

- **Stream** keeps one server-sent events connection open and returns the finished run (optionally with every event that led to it).
- **Poll** re-requests the run on an interval.

For long runs, turn **Wait for Completion** off, store the returned `id`, and follow the run later with **Get Run** — the run keeps going server-side. If a wait times out, or the stream drops and polling cannot recover, the error names the run ID: collect it with **Get Run** rather than creating another run. Polling retries rate limits and server errors with backoff.

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
npm test

# Install the node in your n8n instance
mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm init -y
npm install /path/to/n8n-integration
n8n start
```

## License

[MIT](https://github.com/exa-labs/n8n-integration/blob/main/LICENSE)
