#!/usr/bin/env node

/**
 * noticed CLI — Search your developer network from the terminal.
 *
 * Usage:
 *   noticed search "AI engineers"
 *   noticed search "sarah" --limit 10 --source github
 *   noticed search "react" --json
 *   noticed search "john" --paths
 *   noticed mcp                      # Start MCP server (stdio)
 *
 * Environment:
 *   NOTICED_API_URL   Base URL of your noticed instance
 *   NOTICED_API_KEY   API key for authentication
 */

import { Command } from "commander";
import { searchCommand } from "./commands/search.js";
import { mcpCommand } from "./commands/mcp.js";
import { configCommand } from "./commands/config.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("noticed")
  .description("Developer intelligence — search your network, trace connections, discover paths")
  .version(VERSION, "-v, --version", "Display the current version")
  .option("--api-url <url>", "Override NOTICED_API_URL")
  .option("--api-key <key>", "Override NOTICED_API_KEY");

// ── search ──────────────────────────────────────────────────────────────────
program
  .command("search <query>")
  .description("Search your developer network for people, companies, skills, or topics")
  .option("-l, --limit <n>", "Maximum results to return", "25")
  .option("-o, --offset <n>", "Offset for pagination", "0")
  .option("-s, --source <source>", "Filter by source (github, linkedin)")
  .option("-p, --paths", "Include connection paths to each result")
  .option("-j, --json", "Output raw JSON")
  .option("--no-color", "Disable colored output")
  .action(searchCommand);

// ── mcp ─────────────────────────────────────────────────────────────────────
program
  .command("mcp")
  .description("Start the MCP (Model Context Protocol) server over stdio for AI agent integration")
  .option("--log-level <level>", "Log level (debug, info, warn, error)", "warn")
  .action(mcpCommand);

// ── config ──────────────────────────────────────────────────────────────────
program
  .command("config")
  .description("Show or set configuration")
  .option("--set-url <url>", "Set the API URL")
  .option("--set-key <key>", "Set the API key")
  .option("--show", "Show current configuration")
  .action(configCommand);

program.parse(process.argv);
