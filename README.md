# @noticed/cli

CLI and MCP server for [noticed](https://noticed.so) developer intelligence. Search your network, trace connections, and discover the shortest path to anyone through your GitHub and LinkedIn graph.

## Installation

```bash
npm install @noticed/cli
```

Or run directly:

```bash
npx @noticed/cli search "AI engineers"
```

## Quick Start

```bash
# 1. Mint an API key in the dashboard at /dashboard/api-keys (one-time reveal).
# 2. Configure credentials:
noticed config --set-url https://your-instance.noticed.so
noticed config --set-key nk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 3. Search your network
noticed search "react developers"

# 4. Find the shortest path to a specific person
noticed path @sarahml
noticed path --li sarah-chen

# 5. Search with per-row paths to the top hits
noticed search "Sarah Chen" --paths

# 6. JSON output for scripting
noticed search "frontend" --json | jq '.hits[].github_login'
```

## Authentication

The CLI authenticates to your noticed instance with a Bearer API key. Mint one at
`/dashboard/api-keys` — the secret is only shown at create time, so copy it
immediately. Tokens look like `nk_live_…` and rate-limit at 60 requests per minute
per key. Revoke compromised keys from the same page.

## Commands

### `noticed search <query>`

Search your developer network for people, companies, skills, or topics.

```bash
noticed search "AI engineers"               # natural language
noticed search "@sarahml"                    # GitHub username
noticed search "CTO at Vercel"              # job title + company
noticed search "kubernetes" --source github  # filter by source
noticed search "react" --limit 10 --json    # paginated JSON output
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-l, --limit <n>` | Maximum results | 25 |
| `-o, --offset <n>` | Pagination offset | 0 |
| `-s, --source <src>` | Filter: `github` or `linkedin` | all |
| `--sort <col:dir>` | Sort: `name:asc`, `company:desc` | none |
| `-p, --paths` | Show connection paths to top hits | off |
| `-j, --json` | Output raw JSON | off |
| `--csv` | Output as CSV | off |
| `--no-color` | Disable colors | auto |

### `noticed path [target]`

Find the shortest connection path between you and a specific person.

```bash
noticed path @sarahml             # by GitHub login
noticed path 12345                # by github_user_id
noticed path --li sarah-chen      # by LinkedIn username
noticed path @sarahml --json      # machine-readable
```

The CLI resolves a login by searching first, then calling the path endpoint.
Pass `--li` to skip search and look up by LinkedIn username directly.

### `noticed config`

Show or set CLI configuration.

```bash
noticed config                     # show current config
noticed config --set-url <url>     # set API URL
noticed config --set-key <key>     # set API key
noticed config --show              # show current config
```

Configuration is stored at `~/.config/noticed/config.json` (XDG-compliant).

### `noticed mcp`

Start the MCP (Model Context Protocol) server over stdio for AI agent integration.

```bash
noticed mcp
noticed mcp --log-level debug
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NOTICED_API_URL` | Base URL of your noticed instance | Yes |
| `NOTICED_API_KEY` | API key for authentication | Yes |
| `NOTICED_BASE_URL` | Alias for `NOTICED_API_URL` | No |

Precedence: CLI flags > environment variables > config file.

## MCP Server Setup

The MCP server exposes two tools to AI agents:

- **`search_network`** — Search developers by name, company, skill, or topic
- **`get_connection_path`** — Find the shortest path to a target person

### Claude Code / Cursor / Windsurf

Add to your MCP settings (e.g., `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "noticed": {
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": {
        "NOTICED_API_URL": "https://your-instance.noticed.so",
        "NOTICED_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "noticed": {
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": {
        "NOTICED_API_URL": "https://your-instance.noticed.so",
        "NOTICED_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Testing the MCP Server

```bash
# Send an initialize request
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | noticed mcp

# List available tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":2}' | noticed mcp
```

## Programmatic Usage

```typescript
import { NoticedApiClient } from "@noticed/cli";

const client = new NoticedApiClient({
  baseUrl: "https://your-instance.noticed.so",
  apiKey: "your-api-key",
});

const results = await client.search("AI engineers", {
  limit: 10,
  paths: true,
});

console.log(results.hits);
console.log(results.paths);
```

## License

MIT
