# @noticed/cli

[![npm version](https://img.shields.io/npm/v/@noticed/cli.svg)](https://www.npmjs.com/package/@noticed/cli)
[![npm downloads](https://img.shields.io/npm/dm/@noticed/cli.svg)](https://www.npmjs.com/package/@noticed/cli)
[![CI](https://github.com/noticedso/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/noticedso/cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

CLI, MCP server, and Claude Code plugin for [noticed](https://noticed.so) — search your developer network, trace connections, and find the shortest path to anyone through GitHub and LinkedIn collaboration graphs.

```bash
npm install -g @noticed/cli
noticed search "AI engineers"
noticed path @sarahml
```

---

## Add to your AI coding agent

The MCP server exposes two tools — `search_network` and `get_connection_path` — to any client that speaks Model Context Protocol. Pick your client below.

### Claude Code

```bash
claude mcp add --scope project noticed -- npx -y @noticed/cli mcp
```

`--scope project` writes to `.mcp.json` at your repo root so the server is shared with everyone on the team. Drop the flag for a personal-scope install.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "noticed": {
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": {
        "NOTICED_API_URL": "https://your-instance.noticed.so",
        "NOTICED_API_KEY": "nk_live_…"
      }
    }
  }
}
```

### Cursor

Edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "noticed": {
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": { "NOTICED_API_URL": "https://your-instance.noticed.so", "NOTICED_API_KEY": "nk_live_…" }
    }
  }
}
```

### VS Code (Copilot Chat, GitHub Copilot agent mode)

Edit `.vscode/mcp.json` for workspace, or run **MCP: Open User Configuration** for global:

```json
{
  "servers": {
    "noticed": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": { "NOTICED_API_URL": "https://your-instance.noticed.so", "NOTICED_API_KEY": "nk_live_…" }
    }
  }
}
```

Note VS Code uses `servers` (not `mcpServers`) and requires `type`.

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "noticed": {
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": { "NOTICED_API_URL": "https://your-instance.noticed.so", "NOTICED_API_KEY": "nk_live_…" }
    }
  }
}
```

### Cline (VS Code)

Edit `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "noticed": {
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": { "NOTICED_API_URL": "https://your-instance.noticed.so", "NOTICED_API_KEY": "nk_live_…" }
    }
  }
}
```

### Continue

MCP works in **agent mode** only. Add `.continue/mcpServers/noticed.yaml`:

```yaml
mcpServers:
  - name: noticed
    command: npx
    args: ["-y", "@noticed/cli", "mcp"]
    env:
      NOTICED_API_URL: https://your-instance.noticed.so
      NOTICED_API_KEY: nk_live_…
```

### Zed

Edit `~/.config/zed/settings.json` (note: key is `context_servers`, not `mcpServers`):

```json
{
  "context_servers": {
    "noticed": {
      "command": "npx",
      "args": ["-y", "@noticed/cli", "mcp"],
      "env": { "NOTICED_API_URL": "https://your-instance.noticed.so", "NOTICED_API_KEY": "nk_live_…" }
    }
  }
}
```

---

## Claude Code skill

This package ships a Claude Code skill at `skills/noticed-search/SKILL.md`. Skills don't auto-discover from `node_modules` — symlink it into your skills directory once:

```bash
# Personal scope (all projects)
mkdir -p ~/.claude/skills
ln -s "$(npm root -g)/@noticed/cli/skills/noticed-search" ~/.claude/skills/noticed-search

# Project scope (this repo only)
mkdir -p .claude/skills
ln -s "$(npm root)/@noticed/cli/skills/noticed-search" .claude/skills/noticed-search
```

Or install the whole thing as a Claude Code **plugin** (skill + MCP bundled):

```bash
git clone https://github.com/noticedso/cli ~/.claude/plugins/noticed
# restart Claude Code
```

---

## Quick start (CLI)

```bash
# 1. Mint an API key in your noticed dashboard at /dashboard/api-keys
# 2. Configure credentials
noticed config --set-url https://your-instance.noticed.so
noticed config --set-key nk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 3. Search your network
noticed search "react developers"

# 4. Find the shortest path to a specific person
noticed path @sarahml
noticed path --li sarah-chen

# 5. JSON output for scripting
noticed search "frontend" --json | jq '.hits[].github_login'
```

---

## Authentication

The CLI authenticates with a Bearer API key. Mint one at `/dashboard/api-keys` — the secret is shown once at create time, so copy it immediately. Tokens look like `nk_live_…`, are rate-limited to 60 requests per minute per key, and can be revoked from the same page.

---

## CLI commands

### `noticed search <query>`

Search your developer network for people, companies, skills, or topics.

```bash
noticed search "AI engineers"                  # natural language
noticed search "@sarahml"                      # GitHub username
noticed search "CTO at Vercel"                 # job title + company
noticed search "kubernetes" --source github    # filter by source
noticed search "react" --limit 10 --json       # paginated JSON output
noticed search "engineers" --csv > out.csv     # CSV export
noticed search "Sarah Chen" --paths            # also fetch paths to top hits
```

| Flag | Description | Default |
|------|-------------|---------|
| `-l, --limit <n>` | Maximum results | 25 |
| `-o, --offset <n>` | Pagination offset | 0 |
| `-s, --source <src>` | Filter: `github` or `linkedin` | all |
| `--sort <col:dir>` | Sort: `name:asc`, `company:desc` | none |
| `-p, --paths` | Fetch shortest paths to the top 5 hits | off |
| `-j, --json` | Output raw JSON | off |
| `--csv` | Output as CSV | off |
| `--no-color` | Disable colors | auto |

### `noticed path [target]`

Find the shortest connection path between you and a person.

```bash
noticed path @sarahml             # by GitHub login
noticed path 12345                # by github_user_id
noticed path --li sarah-chen      # by LinkedIn username
noticed path @sarahml --json      # machine-readable
```

Logins are resolved via search before the path lookup. Pass `--li` to skip the search step and look up by LinkedIn username directly.

### `noticed config`

```bash
noticed config                     # show current config
noticed config --set-url <url>     # set API URL
noticed config --set-key <key>     # set API key
noticed config --show              # show current config
```

Config is stored at `~/.config/noticed/config.json` (XDG-compliant).

### `noticed mcp`

```bash
noticed mcp                        # start MCP server over stdio
noticed mcp --log-level debug      # with debug logging on stderr
```

### `noticed completion <shell>`

```bash
noticed completion bash >> ~/.bashrc
noticed completion zsh >> ~/.zshrc
noticed completion fish > ~/.config/fish/completions/noticed.fish
```

---

## Environment variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NOTICED_API_URL` | Base URL of your noticed instance | yes |
| `NOTICED_API_KEY` | API key for authentication | yes |
| `NOTICED_BASE_URL` | Alias for `NOTICED_API_URL` | no |

Precedence: CLI flags > environment variables > config file.

---

## MCP tools

| Tool | Description |
|------|-------------|
| `search_network` | Search developers by name, company, skill, or topic. Optional `source`, `sort`, `limit`, `offset`, `include_paths`. |
| `get_connection_path` | Find the shortest path to a target person. Accepts a natural-language `query`, an explicit `github_user_id`, or a `linkedin_username`. |

Test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx @noticed/cli mcp
```

Or by hand:

```bash
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | noticed mcp
echo '{"jsonrpc":"2.0","method":"tools/list","id":2}' | noticed mcp
```

---

## Programmatic usage

```ts
import { NoticedApiClient } from "@noticed/cli";

const client = new NoticedApiClient({
  baseUrl: "https://your-instance.noticed.so",
  apiKey: "nk_live_…",
});

const results = await client.search("AI engineers", { limit: 10 });
const path = await client.path({ to: results.hits[0]?.github_user_id });

console.log(results.hits, path);
```

---

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run check-types
```

---

## License

[MIT](LICENSE) © noticed
