---
name: noticed-search
description: Search developer networks using noticed — find people, trace connections, and discover the shortest path to anyone through GitHub collaborations and LinkedIn connections.
trigger: Use when the user wants to search for developers, find people in their network, trace connections between people, or discover paths through professional networks. Also triggered by mentions of "noticed", "developer search", "network search", "find developers", "connection path", or "who knows".
allowed-tools:
  - Bash(noticed:*)
---

# noticed Search Skill

You have access to the `noticed` CLI for searching developer networks.

## Available Commands

### Search Network
```bash
noticed search "<query>" [options]
```

**Options:**
- `-l, --limit <n>` — Maximum results (default 25, max 50)
- `-o, --offset <n>` — Pagination offset
- `-s, --source <github|linkedin>` — Filter by source
- `--sort <col:dir>` — Sort by `name:asc`, `company:desc`, etc.
- `-p, --paths` — Lazily fetch the shortest connection path to the top 5 hits
- `-j, --json` — Output JSON for further processing
- `--no-color` — Disable colors

**Examples:**
```bash
# Search by name
noticed search "Sarah Chen"

# Search by skill/topic
noticed search "AI engineers" --limit 10

# Search by company
noticed search "engineers at Google" --source github

# Get JSON output for processing (includes paths to top 5 hits)
noticed search "react developers" --json --paths

# Paginate results
noticed search "frontend" --offset 25 --limit 25
```

### Find a Path

```bash
noticed path @sarahml             # by GitHub login
noticed path 12345                # by github_user_id
noticed path --li sarah-chen      # by LinkedIn username
noticed path @sarahml --json      # machine-readable
```

Use this when you already know who you want to reach. The CLI resolves a login
by searching first, then calls the dedicated `/api/search/path` endpoint.

### Configuration
```bash
# Mint an API key in the dashboard at /dashboard/api-keys, then:
noticed config --set-url https://your-instance.noticed.so
noticed config --set-key nk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Show current config
noticed config --show
```

### MCP Server (for AI agent integration)
```bash
# Start MCP server over stdio
noticed mcp
```

## Environment Variables

The CLI reads credentials from:
1. CLI flags (`--api-url`, `--api-key`)
2. Environment variables (`NOTICED_API_URL`, `NOTICED_API_KEY`)
3. Config file (`~/.config/noticed/config.json`)

## Search Tips

- **Natural language**: "AI engineers at startups", "frontend developers who know React"
- **Names**: "Sarah Chen", "John Smith" — searches both GitHub and LinkedIn
- **Usernames**: "@sarahml" — direct GitHub login lookup
- **Companies**: "Google", "Vercel" — matches company fields
- **Skills/Topics**: "kubernetes", "machine learning" — matches skills and repo topics
- **Combined**: Queries with 3+ words automatically validate extra words against company/headline

## Connection Paths

When `--paths` is used, the CLI shows the shortest path from you to each person:

```
You ──collab──▸ Alice ──LinkedIn──▸ Bob ──collab──▸ Target (3 hops)
```

This helps understand how you're connected to someone outside your direct network.
