#!/usr/bin/env node

/**
 * noticed CLI — Search your developer network from the terminal.
 *
 * Environment:
 *   NOTICED_API_URL   Base URL of your noticed instance
 *   NOTICED_API_KEY   API key for authentication
 */

import { Command, CommanderError } from "commander";
import { searchCommand } from "./commands/search.js";
import { pathCommand } from "./commands/path.js";
import { mcpCommand } from "./commands/mcp.js";
import { configCommand } from "./commands/config.js";
import { completionCommand } from "./commands/completion.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("noticed")
  .description("Developer intelligence — search your network, trace connections, discover paths")
  .version(VERSION, "-v, --version", "Display the current version")
  .option("--api-url <url>", "Override NOTICED_API_URL")
  .option("--api-key <key>", "Override NOTICED_API_KEY")
  .exitOverride();

// ── search ──────────────────────────────────────────────────────────────────
program
  .command("search <query>")
  .description("Search your developer network for people, companies, skills, or topics")
  .option("-l, --limit <n>", "Maximum results to return", "25")
  .option("-o, --offset <n>", "Offset for pagination", "0")
  .option("-s, --source <source>", "Filter by source (github, linkedin)")
  .option("--sort <column:dir>", "Sort results (name:asc, company:desc)")
  .option("-c, --columns <cols>", "Columns to display (comma-separated: name,company,source,matched,skills,headline)")
  .option("-p, --paths", "Include connection paths to each result")
  .option("-j, --json", "Output raw JSON")
  .option("--csv", "Output as CSV")
  .option("-q, --quiet", "Suppress headers and formatting, output data only")
  .option("--verbose", "Show all columns including headline")
  .option("--no-color", "Disable colored output")
  .addHelpText("after", `
Examples:
  noticed search "AI engineers"                  Search by natural language
  noticed search "@sarahml"                      Search by GitHub username
  noticed search "react" --source github         Filter by source
  noticed search "CTO" --sort name:asc           Sort by name ascending
  noticed search "frontend" --json               JSON output for scripting
  noticed search "engineers" --csv > results.csv Export to CSV
  noticed search "vercel" --columns name,company Custom columns
  noticed search "ML" --paths                    Show connection paths
  noticed search "python" --quiet                Machine-readable output`)
  .action(searchCommand);

// ── path ────────────────────────────────────────────────────────────────────
program
  .command("path [target]")
  .description("Find the shortest connection path to a person")
  .option("--li <username>", "LinkedIn username (use instead of a positional GitHub login)")
  .option("-j, --json", "Output raw JSON")
  .option("--no-color", "Disable colored output")
  .addHelpText("after", `
Examples:
  noticed path @sarahml                  Find path by GitHub login
  noticed path 12345                     Find path by github_user_id
  noticed path --li sarah-chen           Find path by LinkedIn username
  noticed path @sarahml --json           Machine-readable output`)
  .action(pathCommand);

// ── mcp ─────────────────────────────────────────────────────────────────────
program
  .command("mcp")
  .description("Start the MCP (Model Context Protocol) server over stdio for AI agent integration")
  .option("--log-level <level>", "Log level (debug, info, warn, error)", "warn")
  .addHelpText("after", `
Examples:
  noticed mcp                           Start MCP server
  noticed mcp --log-level debug         Start with debug logging

MCP Setup (Claude Code / Cursor):
  Add to settings: { "mcpServers": { "noticed": { "command": "npx", "args": ["-y", "@noticed/cli", "mcp"] } } }`)
  .action(mcpCommand);

// ── config ──────────────────────────────────────────────────────────────────
program
  .command("config")
  .description("Show or set configuration")
  .option("--set-url <url>", "Set the API URL")
  .option("--set-key <key>", "Set the API key")
  .option("--show", "Show current configuration")
  .addHelpText("after", `
Examples:
  noticed config                                Show current config
  noticed config --set-url https://noticed.so   Set API URL
  noticed config --set-key sk_abc123            Set API key`)
  .action(configCommand);

// ── completion ──────────────────────────────────────────────────────────────
program
  .command("completion [shell]")
  .description("Generate shell completion script (bash, zsh, fish)")
  .addHelpText("after", `
Examples:
  noticed completion bash >> ~/.bashrc          Add bash completions
  noticed completion zsh >> ~/.zshrc            Add zsh completions
  noticed completion fish > ~/.config/fish/completions/noticed.fish`)
  .action(completionCommand);

// ── Signal handling ─────────────────────────────────────────────────────────
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

// ── Parse with exit code handling ───────────────────────────────────────────
try {
  program.parse(process.argv);
} catch (err) {
  if (err instanceof CommanderError) {
    // Exit code 2 for usage/argument errors (e.g., missing required arg)
    if (err.exitCode !== 0) {
      process.exit(err.code === "commander.missingArgument" ? 2 : err.exitCode);
    }
  } else {
    throw err;
  }
}
