/**
 * Stdio compatibility bridge for the canonical hosted noticed MCP.
 *
 * The hosted Streamable HTTP server owns the tool registry, schemas, resources,
 * authentication policy, and version. Keeping the stdio command as a transport
 * proxy means stdio-only clients receive that same direct-tool surface instead
 * of a second, stale `search` / `execute` registry.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const DEFAULT_MCP_URL = "https://mcp.noticed.so/api/mcp";
const AUTH_HEADER_ENV = "NOTICED_MCP_REMOTE_AUTHORIZATION";

type LogLevel = "debug" | "info" | "warn" | "error";

interface McpServerOptions {
  logLevel?: LogLevel;
}

interface McpProxyLaunchOptions extends McpServerOptions {
  env?: NodeJS.ProcessEnv;
  proxyEntrypoint?: string;
}

export interface McpProxyLaunchConfig {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

function resolveProxyEntrypoint(): string {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("mcp-remote/package.json");
  return join(dirname(packagePath), "dist", "proxy.js");
}

function resolveMcpUrl(env: NodeJS.ProcessEnv): URL {
  const explicitMcpUrl = env["NOTICED_MCP_URL"]?.trim();
  if (explicitMcpUrl) return new URL(explicitMcpUrl);

  const selfHostedBaseUrl =
    env["NOTICED_API_URL"]?.trim() ?? env["NOTICED_BASE_URL"]?.trim();
  if (selfHostedBaseUrl) {
    const baseUrl = new URL(selfHostedBaseUrl);
    if (
      baseUrl.protocol === "https:" &&
      (baseUrl.hostname === "noticed.so" ||
        baseUrl.hostname === "www.noticed.so")
    ) {
      return new URL(DEFAULT_MCP_URL);
    }
    return new URL("/api/mcp", baseUrl);
  }

  return new URL(DEFAULT_MCP_URL);
}

export function buildMcpProxyLaunchConfig(
  options: McpProxyLaunchOptions = {},
): McpProxyLaunchConfig {
  const env = options.env ?? process.env;
  const apiKey = env["NOTICED_API_KEY"]?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing NOTICED_API_KEY environment variable.\n" +
        "Mint an API key at https://www.noticed.so/dashboard/api-keys.",
    );
  }

  const mcpUrl = resolveMcpUrl(env);
  if (mcpUrl.protocol !== "https:" && mcpUrl.protocol !== "http:") {
    throw new Error("NOTICED_MCP_URL must use http or https.");
  }

  const args = [
    options.proxyEntrypoint ?? resolveProxyEntrypoint(),
    mcpUrl.toString(),
    "--transport",
    "http-only",
    "--header",
    `Authorization:\${${AUTH_HEADER_ENV}}`,
    "--silent",
  ];

  if (mcpUrl.protocol === "http:") args.push("--allow-http");
  if (options.logLevel === "debug") args.push("--debug");

  return {
    command: process.execPath,
    args,
    env: {
      ...env,
      [AUTH_HEADER_ENV]: `Bearer ${apiKey}`,
    },
  };
}

export async function startMcpServer(options?: McpServerOptions): Promise<void> {
  const launch = buildMcpProxyLaunchConfig(options);
  const child = spawn(launch.command, launch.args, {
    env: launch.env,
    stdio: "inherit",
  });

  const forwardSignal = (signal: NodeJS.Signals) => {
    if (!child.killed) child.kill(signal);
  };
  const forwardSigint = () => forwardSignal("SIGINT");
  const forwardSigterm = () => forwardSignal("SIGTERM");

  process.prependOnceListener("SIGINT", forwardSigint);
  process.prependOnceListener("SIGTERM", forwardSigterm);

  try {
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
          resolve();
          return;
        }
        reject(
          new Error(
            `noticed MCP proxy exited ${signal ? `from ${signal}` : `with code ${code ?? "unknown"}`}`,
          ),
        );
      });
    });
  } finally {
    process.removeListener("SIGINT", forwardSigint);
    process.removeListener("SIGTERM", forwardSigterm);
  }
}
