/**
 * MCP (Model Context Protocol) server for noticed.
 *
 * Implements the MCP specification over stdio (JSON-RPC 2.0, newline-delimited).
 * Exposes two meta-tools (`search` + `execute`) backed by the same capability
 * registry that powers the noticed web and Telegram agents. A nine-name
 * server-side denylist filters chat-only capabilities (message, referrals,
 * cursor-cloud, etc.) so MCP/CLI clients only see capabilities that work
 * outside a chat context.
 *
 * Specification: https://modelcontextprotocol.io/specification
 *
 * Tools provided:
 *   - search: Discover capabilities by query/category, returns names + schemas
 *   - execute: Run a named capability with arguments
 *
 * Usage:
 *   noticed mcp                     # Start server (stdio)
 *   echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{...}}' | noticed mcp
 */

import { z } from "zod";
import { createClientFromEnv } from "./api-client.js";
import { VERSION } from "./version.js";
import * as readline from "node:readline";

// ---------------------------------------------------------------------------
// Zod schemas for tool input validation (single source of truth)
// ---------------------------------------------------------------------------

export const SearchArgsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(50),
});

export const ExecuteArgsSchema = z.object({
  capability: z.string().min(1, "capability is required"),
  args: z.record(z.unknown()).optional(),
});

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
    name: "search",
    description:
      "Discover noticed capabilities by keyword and optional category. Returns names, descriptions, categories, and JSON parameter schemas. Call with no arguments to list everything. This is the source of truth for which capabilities exist — do not assume a fixed list.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Optional keyword to filter capabilities by name, description, or category.",
        },
        category: {
          type: "string",
          description:
            "Optional exact category: search, memory, scheduling, workspace, onboarding, missions, sessions, prm, network, custom.",
        },
        limit: {
          type: "number",
          description:
            "Maximum results (1-50, default 50 — returns the full chat-safe registry for an unfiltered call).",
          minimum: 1,
          maximum: 50,
          default: 50,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "execute",
    description:
      "Run a capability by exact name. Use `search` first to find the name and required arguments. Pass capability arguments in the `args` object (e.g. args: { mission_id: '...' }).",
    inputSchema: {
      type: "object" as const,
      properties: {
        capability: {
          type: "string",
          description: "Capability name from search results.",
        },
        args: {
          type: "object",
          description:
            "Arguments object matching the capability's parameter schema.",
          additionalProperties: true,
        },
      },
      required: ["capability"],
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
      case "search":
        return await handleSearch(id, rawArgs);

      case "execute":
        return await handleExecute(id, rawArgs);

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

async function handleSearch(
  id: string | number | null,
  rawArgs: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const parsed = SearchArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: `Invalid arguments: ${issues}` }],
        isError: true,
      },
    };
  }

  const client = createClientFromEnv();
  const body = await client.capabilitySearch(parsed.data);
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(body) }],
    },
  };
}

async function handleExecute(
  id: string | number | null,
  rawArgs: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const parsed = ExecuteArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: `Invalid arguments: ${issues}` }],
        isError: true,
      },
    };
  }

  const client = createClientFromEnv();
  const body = await client.capabilityExecute({
    capability: parsed.data.capability,
    args: parsed.data.args ?? {},
  });
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(body) }],
    },
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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
