import { resolveClientConfig } from "./config.js";
import { startMcpServer } from "../mcp-server.js";

interface McpOptions {
  logLevel?: string;
}

export async function mcpCommand(options: McpOptions): Promise<void> {
  resolveClientConfig();
  await startMcpServer({
    logLevel: (options.logLevel ?? "warn") as "debug" | "info" | "warn" | "error",
  });
}
