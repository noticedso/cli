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

import { z } from "zod";
import { createClientFromEnv, type SearchResponse, type ConnectionPath } from "./api-client.js";
import { VERSION } from "./version.js";
import * as readline from "node:readline";

// ---------------------------------------------------------------------------
// Zod schemas for tool input validation (single source of truth)
// ---------------------------------------------------------------------------

export const SearchNetworkArgsSchema = z.object({
  query: z.string().min(1, "query is required and must be non-empty"),
  limit: z.number().int().min(1).max(50).default(25),
  offset: z.number().int().min(0).default(0),
  source: z.enum(["github", "linkedin"]).optional(),
  sort: z.string().optional(),
  include_paths: z.boolean().default(true),
});

export const GetConnectionPathArgsSchema = z
  .object({
    query: z.string().min(1).optional(),
    github_user_id: z.number().int().positive().optional(),
    linkedin_username: z.string().min(1).optional(),
  })
  .refine(
    (v) => !!(v.query || v.github_user_id || v.linkedin_username),
    { message: "Provide query, github_user_id, or linkedin_username" },
  );

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
        sort: {
          type: "string",
          description:
            "Sort directive in the form 'column:direction' (e.g. 'name:asc', 'company:desc')",
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
      "Provide either a natural-language `query` (we search and use the top match) " +
      "or an explicit `github_user_id` / `linkedin_username`. " +
      "Returns the path chain with profiles at each hop and the edge type (GitHub collab or LinkedIn connection).",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Name or identifier of the person to find a path to (e.g., 'Sarah Chen', '@sarahml', 'CTO at Vercel')",
        },
        github_user_id: {
          type: "number",
          description: "Numeric GitHub user id of the target (preferred when known)",
        },
        linkedin_username: {
          type: "string",
          description: "LinkedIn vanity username of the target",
        },
      },
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
      // JSON-RPC 2.0 §5.1: Parse error
      sendResponse({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    if (request.jsonrpc !== "2.0") {
      // JSON-RPC 2.0 §5.1: Invalid Request
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
          // JSON-RPC 2.0 §5.1: Internal error
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

  // Graceful shutdown on signals
  const shutdown = () => {
    log.info("Received shutdown signal, exiting.");
    rl.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

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
        // MCP spec: -32002 = Server not ready (must call initialize first)
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: { code: -32002, message: "Server not initialized — call initialize first" },
        };
      }
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: { tools: TOOLS },
      };

    case "tools/call":
      if (!initialized) {
        // MCP spec: -32002 = Server not ready
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: { code: -32002, message: "Server not initialized — call initialize first" },
        };
      }
      return handleToolCall(id ?? null, params as { name: string; arguments?: Record<string, unknown> }, log);

    default:
      if (isNotification) return null;
      // JSON-RPC 2.0 §5.1: Method not found
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
  const rawArgs = params?.arguments ?? {};

  log.debug(`Tool call: ${toolName}(${JSON.stringify(rawArgs)})`);

  try {
    switch (toolName) {
      case "search_network":
        return await handleSearchNetwork(id, rawArgs);

      case "get_connection_path":
        return await handleGetConnectionPath(id, rawArgs);

      default:
        // JSON-RPC 2.0 §5.1: Invalid params (unknown tool)
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
  rawArgs: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  // Validate input against Zod schema
  const parsed = SearchNetworkArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: `Invalid arguments: ${issues}` }],
        isError: true,
      },
    };
  }

  const args = parsed.data;
  const client = createClientFromEnv();
  const result: SearchResponse = await client.search(args.query, {
    limit: args.limit,
    offset: args.offset,
    sort: args.sort,
    source: args.source,
    paths: false,
  });

  // Filter by source if specified
  let hits = result.hits;
  if (args.source) {
    hits = hits.filter((h) => h.source === args.source);
  }

  // Per-row paths in parallel (the search route returns no embedded paths;
  // we mirror the web UI's lazy /api/search/path lookup).
  const PATH_FETCH_LIMIT = 5;
  const paths: ConnectionPath[] = args.include_paths
    ? (
        await Promise.all(
          hits.slice(0, PATH_FETCH_LIMIT).map((h) =>
            client
              .path({ to: h.github_user_id, li: h.connection_linkedin_username })
              .catch(() => null),
          ),
        )
      ).filter((p): p is ConnectionPath => p != null)
    : [];

  // Format as readable text for the agent
  const lines: string[] = [];
  lines.push(`Found ${hits.length} result${hits.length !== 1 ? "s" : ""} for "${args.query}"`);
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

  if (paths.length > 0) {
    lines.push("Connection Paths:");
    for (const path of paths) {
      lines.push(formatPathText(path));
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        { type: "text", text: lines.join("\n") },
        { type: "text", text: JSON.stringify({ hits, paths, hasMore: result.hasMore }) },
      ],
    },
  };
}

async function handleGetConnectionPath(
  id: string | number | null,
  rawArgs: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  // Validate input against Zod schema
  const parsed = GetConnectionPathArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: `Invalid arguments: ${issues}` }],
        isError: true,
      },
    };
  }

  const args = parsed.data;
  const client = createClientFromEnv();

  // Resolve {to, li} from the supplied target. If only `query` was given,
  // search and use the best match.
  let to: number | null = args.github_user_id ?? null;
  let li: string | null = args.linkedin_username ?? null;
  let label = args.query ?? (to ? `#${to}` : (li ? `@${li}` : "target"));

  if (!to && !li) {
    const search = await client.search(args.query!, { limit: 5, paths: false });
    const candidates = search.hits.filter(
      (h) => h.github_user_id || h.connection_linkedin_username,
    );
    if (candidates.length === 0) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            { type: "text", text: `No matching profiles found for "${args.query}".` },
          ],
        },
      };
    }
    const best = candidates[0]!;
    to = best.github_user_id;
    li = best.connection_linkedin_username;
    const bestName =
      [best.connection_first_name, best.connection_last_name].filter(Boolean).join(" ") ||
      best.github_login ||
      best.connection_linkedin_username ||
      label;
    label = bestName;
  }

  const path = await client.path({ to, li });

  if (!path) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: `No connection path found to ${label}. They may be outside your reachable network.`,
          },
        ],
      },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        { type: "text", text: `Connection path to ${label}:\n${formatPathText(path)}` },
        { type: "text", text: JSON.stringify({ path }) },
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
