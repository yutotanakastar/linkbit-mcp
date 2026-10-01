# linkbit-mcp

MCP server for [LinkBit](https://linkbit.live): shorten links, bulk create, QR codes, and click analytics from Claude, ChatGPT, Cursor, and n8n.

Public docs: [linkbit.live/docs](https://linkbit.live/docs) · [linkbit.live/mcp](https://linkbit.live/mcp)

## Setup

1. Sign in at [linkbit.live](https://linkbit.live) and create an API key (`slk_...`) on the API Keys page.
2. Node.js **18+** is required (`fetch`).

```
APP_URL=https://linkbit.live
API_KEY=slk_your_key
```

Auth against the REST API uses **either** `Authorization: Bearer slk_...` **or** `x-api-key: slk_...`. This server sends Bearer.

## Install

```bash
npx -y linkbit-mcp
```

Claude Code:

```bash
claude mcp add linkbit -e API_KEY=slk_your_key -e APP_URL=https://linkbit.live -- npx -y linkbit-mcp
```

Claude Desktop / Cursor (`mcp.json`):

```json
{
  "mcpServers": {
    "linkbit": {
      "command": "npx",
      "args": ["-y", "linkbit-mcp"],
      "env": {
        "APP_URL": "https://linkbit.live",
        "API_KEY": "slk_your_key"
      }
    }
  }
}
```

## Example prompts

- Shorten https://example.com/campaign as slug spring and utm_source newsletter
- List my links and show clicks for the first id since 2026-01-01
- Disable link `<id>` then generate a print PNG QR

## Tools

| Tool | Parameters | Notes |
| --- | --- | --- |
| `shorten_url` | `destination` (required), `slug`, `note`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | Existing `utm_*` on the URL are not overwritten; `#fragment` is kept |
| `shorten_urls` | `urls[]` with the same fields | Bulk create |
| `list_links` | — | Newest first |
| `update_link` | `id`, optional destination/slug/note/UTM/`disabled` | PATCH |
| `disable_link` | `id`, optional `disabled` (default true) | Stops redirects. `destructiveHint: true` |
| `delete_link` | `id` | Permanent. `destructiveHint: true` |
| `get_qr` | `id`, `format` png\|svg, `color`, `logo`, `print` | PNG as an image block when possible |
| `get_link_stats` | `id`, optional `from`, `to` (YYYY-MM-DD) | Countries, devices, referrers, daily |
| `get_analytics` | — | Account overview |

## Errors

Tool failures (missing key, 401, invalid URL, daily limit, unsafe destination) are returned as `tools/call` with `isError: true` so the model can explain them. Protocol errors (unknown method, bad JSON) stay JSON-RPC errors.

- **401** — API key missing or wrong (`slk_...`). Create a key under API Keys.
- **400** — invalid URL, slug taken, daily create limit, blocked or unsafe destination.
- **404** — unknown link id.
- Process fails at start if Node is older than 18 (`fetch` is required).

n8n, Make, and custom agents can also call `/api/v1` with the same headers.

## Local development (ShortLinks monorepo)

Until `npm publish`, Cursor can run the copy in this folder:

1. Copy `mcp/cursor.mcp.json.example` to **`.cursor/mcp.json`** (gitignored) or `~/.cursor/mcp.json`.
2. Paste the `slk_…` key into `env.API_KEY`.
3. For this repo before publish, use `"command": "node"` and `"args": ["mcp/src/index.js"]`.
