import { existsSync } from "node:fs";
import { basename } from "node:path";
import { describe, expect, it } from "vitest";

import { buildMcpProxyLaunchConfig } from "../src/mcp-server.js";

describe("noticed MCP stdio proxy", () => {
  it("resolves the packaged proxy entrypoint", () => {
    const config = buildMcpProxyLaunchConfig({
      env: { NOTICED_API_KEY: "nk_live_test" },
    });

    expect(existsSync(config.args[0] ?? "")).toBe(true);
  });

  it("bridges the canonical hosted MCP without putting the API key in process arguments", () => {
    const config = buildMcpProxyLaunchConfig({
      env: { NOTICED_API_KEY: "nk_live_test-secret" },
      proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
    });

    expect(config.command).toBe(process.execPath);
    expect(basename(config.args[0] ?? "")).toBe("proxy.js");
    expect(config.args).toContain("https://mcp.noticed.so/api/mcp");
    expect(config.args).toContain("http-only");
    expect(config.args).toContain(
      "Authorization:${NOTICED_MCP_REMOTE_AUTHORIZATION}",
    );
    expect(config.args.join(" ")).not.toContain("nk_live_test-secret");
    expect(config.env["NOTICED_MCP_REMOTE_AUTHORIZATION"]).toBe(
      "Bearer nk_live_test-secret",
    );
  });

  it("uses an explicit remote MCP URL when configured", () => {
    const config = buildMcpProxyLaunchConfig({
      env: {
        NOTICED_API_KEY: "nk_live_test",
        NOTICED_MCP_URL: "https://relationships.example/mcp",
      },
      proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
    });

    expect(config.args).toContain("https://relationships.example/mcp");
  });

  it("derives a self-hosted MCP endpoint from NOTICED_API_URL", () => {
    const config = buildMcpProxyLaunchConfig({
      env: {
        NOTICED_API_KEY: "nk_live_test",
        NOTICED_API_URL: "https://noticed.example/base/",
      },
      proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
    });

    expect(config.args).toContain("https://noticed.example/api/mcp");
  });

  it.each(["https://noticed.so", "https://www.noticed.so/"])(
    "maps the hosted app URL %s to the canonical MCP host",
    (hostedAppUrl) => {
      const config = buildMcpProxyLaunchConfig({
        env: {
          NOTICED_API_KEY: "nk_live_test",
          NOTICED_API_URL: hostedAppUrl,
        },
        proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
      });

      expect(config.args).toContain("https://mcp.noticed.so/api/mcp");
    },
  );

  it("allows an explicitly configured HTTP endpoint for local self-hosting", () => {
    const config = buildMcpProxyLaunchConfig({
      env: {
        NOTICED_API_KEY: "nk_live_test",
        NOTICED_MCP_URL: "http://127.0.0.1:3012/api/mcp",
      },
      proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
    });

    expect(config.args).toContain("--allow-http");
  });

  it("enables proxy debug logging only for the debug log level", () => {
    const debug = buildMcpProxyLaunchConfig({
      env: { NOTICED_API_KEY: "nk_live_test" },
      logLevel: "debug",
      proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
    });
    const quiet = buildMcpProxyLaunchConfig({
      env: { NOTICED_API_KEY: "nk_live_test" },
      logLevel: "warn",
      proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
    });

    expect(debug.args).toContain("--debug");
    expect(quiet.args).not.toContain("--debug");
    expect(debug.args).toContain("--silent");
    expect(quiet.args).toContain("--silent");
  });

  it("fails before spawning when no API key is configured", () => {
    expect(() =>
      buildMcpProxyLaunchConfig({
        env: {},
        proxyEntrypoint: "/tmp/mcp-remote/dist/proxy.js",
      }),
    ).toThrow(/Missing NOTICED_API_KEY/);
  });
});
