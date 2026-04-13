/**
 * MCP (Model Context Protocol) server for noticed.
 *
 * Implements the MCP specification over stdio (JSON-RPC 2.0, newline-delimited).
 * Exposes noticed search capabilities as tools that AI agents can call.
 *
 * Specification: https://modelcontextprotocol.io/specification
 *
 * Tools provided:
 *   - search_network: Search developers in the user's network
 *   - get_connection_path: Find the shortest path between users
 *
 * Usage:
 *   noticed mcp                     # Start server (stdio)
 *   echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{...}}' | noticed mcp
 */

import { createClientFromEnv, type SearchResponse, type ConnectionPath } from "./api-client.js";
import { VERSION } from "./version.js";
import * as readline from "node:readline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpServerOptions {
  logLevel?: "debug" | "info" | "warn" | "error";
}

// ---------------------------------------------------------------------------
// MCP Protocol constants
// ---------------------------------------------------------------------------

const SERVER_INFO = {
  name: "noticed",
  version: VERSION,
};

const SERVER_CAPABILITIES = {
  tools: {},
};

const TOOLS = [
  {
    name: "search_network",
    description:
      "Search the user's developer network across GitHub collaborators and LinkedIn connections. " +
      "Supports natural language queries: names, companies, skills, topics, job titles. " +
      "Returns matching profiles with source attribution and connection paths showing how the user is connected to each result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query — a name, company, skill, topic, or natural language description (e.g., 'AI engineers at Google', 'react developers', 'sarahml')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (1-50, default 25)",
          minimum: 1,
          maximum: 50,
          default: 25,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
          minimum: 0,
          default: 0,
        },
        source: {
          type: "string",
          enum: ["github", "linkedin"],
          description: "Filter results by source (omit for all sources)",
        },
        include_paths: {
          type: "boolean",
          description:
            "Include connection paths showing how you're connected to each result (default true)",
          default: true,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_connection_path",
    description:
      "Find the shortest connection path from the current user to a target person. " +
      "Uses BFS traversal across GitHub collaboration and LinkedIn connection edges. " +
      "Returns the path chain with profiles at each hop and the edge type (GitHub collab or LinkedIn connection).",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Name or identifier of the person to find a path to (e.g., 'Sarah Chen', '@sarahml', 'CTO at Vercel')",
        },
        max_hops: {
          type: "number",
          description: "Maximum path depth (1-6, default 4)",
          minimum: 1,
          maximum: 6,
          default: 4,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export async function startMcpServer(options?: McpServerOptions): Promise<void> {
  const logLevel = options?.logLevel ?? "warn";
  const log = createLogger(logLevel);

  log.info("Starting noticed MCP server...");

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  let initialized = false;

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    log.debug(`← ${trimmed}`);

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      sendResponse({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    if (request.jsonrpc !== "2.0") {
      sendResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: { code: -32600, message: "Invalid Request — expected jsonrpc 2.0" },
      });
      return;
    }

    handleRequest(request, initialized, log)
      .then((response) => {
        if (request.method === "initialize") initialized = true;
        if (response) sendResponse(response);
      })
      .catch((err) => {
        log.error(`Handler error: ${err}`);
        if (request.id != null) {
          sendResponse({
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32603, message: "Internal error", data: String(err) },
          });
        }
      });
  });

  rl.on("close", () => {
    log.info("MCP server stdin closed, exiting.");
    process.exit(0);
  });

  // Keep process alive
  process.stdin.resume();
}

async function handleRequest(
  request: JsonRpcRequest,
  initialized: boolean,
  log: Logger,
): Promise<JsonRpcResponse | null> {
  const { method, id, params } = request;

  // Notifications (no id) don't get responses except for errors
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: SERVER_CAPABILITIES,
          serverInfo: SERVER_INFO,
        },
      };

    case "notifications/initialized":
      log.info("Client initialized.");
      return null;

    case "ping":
      return { jsonrpc: "2.0", id: id ?? null, result: {} };

    case "tools/list":
      if (!initialized) {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: { code: -32002, message: "Server not initialized" },
        };
      }
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: { tools: TOOLS },
      };

    case "tools/call":
      if (!initialized) {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: { code: -32002, message: "Server not initialized" },
        };
      }
      return handleToolCall(id ?? null, params as { name: string; arguments?: Record<string, unknown> }, log);

    default:
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

async function handleToolCall(
  id: string | number | null,
  params: { name: string; arguments?: Record<string, unknown> },
  log: Logger,
): Promise<JsonRpcResponse> {
  const toolName = params?.name;
  const args = params?.arguments ?? {};

  log.debug(`Tool call: ${toolName}(${JSON.stringify(args)})`);

  try {
    switch (toolName) {
      case "search_network":
        return await handleSearchNetwork(id, args);

      case "get_connection_path":
        return await handleGetConnectionPath(id, args);

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      },
    };
  }
}

async function handleSearchNetwork(
  id: string | number | null,
  args: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const query = String(args["query"] ?? "");
  if (!query.trim()) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: "Error: query parameter is required" }],
        isError: true,
      },
    };
  }

  const client = createClientFromEnv();
  const result: SearchResponse = await client.search(query, {
    limit: typeof args["limit"] === "number" ? args["limit"] : 25,
    offset: typeof args["offset"] === "number" ? args["offset"] : 0,
    paths: args["include_paths"] !== false,
  });

  // Filter by source if specified
  let hits = result.hits;
  if (typeof args["source"] === "string") {
    hits = hits.filter((h) => h.source === args["source"]);
  }

  // Format as readable text for the agent
  const lines: string[] = [];
  lines.push(`Found ${hits.length} result${hits.length !== 1 ? "s" : ""} for "${query}"`);
  if (result.hasMore) lines.push("(more results available with pagination)");
  lines.push("");

  for (const hit of hits) {
    const name = [hit.connection_first_name, hit.connection_last_name]
      .filter(Boolean)
      .join(" ");
    const login = hit.github_login ? `@${hit.github_login}` : "";
    const display = name ? `${name}${login ? ` (${login})` : ""}` : login || "Unknown";

    lines.push(`• ${display}`);
    if (hit.connection_company) lines.push(`  Company: ${hit.connection_company}`);
    if (hit.profile_headline) lines.push(`  Headline: ${hit.profile_headline}`);
    lines.push(`  Source: ${hit.source} | Matched on: ${hit.matched_on}`);
    const skills = [...hit.profile_skills, ...hit.topics].slice(0, 5);
    if (skills.length > 0) lines.push(`  Skills: ${skills.join(", ")}`);
    lines.push("");
  }

  // Include paths if available
  if (result.paths.length > 0) {
    lines.push("Connection Paths:");
    for (const path of result.paths) {
      lines.push(formatPathText(path));
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        { type: "text", text: lines.join("\n") },
        { type: "text", text: JSON.stringify({ hits, paths: result.paths, hasMore: result.hasMore }) },
      ],
    },
  };
}

async function handleGetConnectionPath(
  id: string | number | null,
  args: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const query = String(args["query"] ?? "");
  if (!query.trim()) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: "Error: query parameter is required" }],
        isError: true,
      },
    };
  }

  // Use search with paths to find the person and their connection path
  const client = createClientFromEnv();
  const result = await client.search(query, {
    limit: 5,
    paths: true,
  });

  if (result.paths.length === 0) {
    const hint = result.hits.length > 0
      ? "Found matching profiles but no connection paths. The person may be directly in your network."
      : "No matching profiles or paths found.";

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: hint }],
      },
    };
  }

  const lines: string[] = [];
  lines.push(`Connection path${result.paths.length > 1 ? "s" : ""} to "${query}":\n`);

  for (const path of result.paths) {
    lines.push(formatPathText(path));
    lines.push("");
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        { type: "text", text: lines.join("\n") },
        { type: "text", text: JSON.stringify(result.paths) },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatPathText(path: ConnectionPath): string {
  const profileMap = new Map(
    path.profiles.map((p) => [p.github_user_id, p]),
  );

  const startProfile = profileMap.get(path.from_user_id);
  const parts: string[] = [startProfile?.name ?? startProfile?.login ?? "You"];

  for (const hop of path.hops) {
    const profile = profileMap.get(hop.to_user_id);
    const name = profile?.name ?? profile?.login ?? `#${hop.to_user_id}`;
    const edge = hop.edge_type === "linkedin" ? "──LinkedIn──▸" : "──collab──▸";
    parts.push(`${edge} ${name}`);
  }

  return `  ${parts.join(" ")} (${path.total_hops} hop${path.total_hops !== 1 ? "s" : ""})`;
}

function sendResponse(response: JsonRpcResponse): void {
  const json = JSON.stringify(response);
  process.stdout.write(json + "\n");
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

interface Logger {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

function createLogger(level: keyof typeof LOG_LEVELS): Logger {
  const threshold = LOG_LEVELS[level];
  const emit = (lvl: keyof typeof LOG_LEVELS, msg: string) => {
    if (LOG_LEVELS[lvl] >= threshold) {
      process.stderr.write(`[noticed-mcp] [${lvl}] ${msg}\n`);
    }
  };
  return {
    debug: (msg) => emit("debug", msg),
    info: (msg) => emit("info", msg),
    warn: (msg) => emit("warn", msg),
    error: (msg) => emit("error", msg),
  };
}
