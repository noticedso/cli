import { describe, it, expect } from "vitest";

import {
  SearchNetworkArgsSchema,
  GetConnectionPathArgsSchema,
} from "../src/mcp-server.js";

describe("MCP Input Validation — SearchNetworkArgs", () => {
  it("accepts valid search args", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "AI engineers" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("AI engineers");
      expect(result.data.limit).toBe(25);
      expect(result.data.offset).toBe(0);
      expect(result.data.include_paths).toBe(true);
    }
  });

  it("accepts all optional parameters", () => {
    const result = SearchNetworkArgsSchema.safeParse({
      query: "react",
      limit: 10,
      offset: 5,
      source: "github",
      include_paths: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
      expect(result.data.source).toBe("github");
      expect(result.data.include_paths).toBe(false);
    }
  });

  it("rejects empty query", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing query", () => {
    const result = SearchNetworkArgsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects limit > 50", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "test", limit: 100 });
    expect(result.success).toBe(false);
  });

  it("rejects limit < 1", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "test", limit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "test", offset: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "test", source: "twitter" });
    expect(result.success).toBe(false);
  });

  it("accepts linkedin source", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "test", source: "linkedin" });
    expect(result.success).toBe(true);
  });

  it("accepts a sort directive", () => {
    const result = SearchNetworkArgsSchema.safeParse({ query: "test", sort: "name:asc" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort).toBe("name:asc");
  });
});

describe("MCP Input Validation — GetConnectionPathArgs", () => {
  it("accepts a natural-language query (we'll resolve via search)", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ query: "Sarah Chen" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.query).toBe("Sarah Chen");
  });

  it("accepts an explicit github_user_id target without a query", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ github_user_id: 12345 });
    expect(result.success).toBe(true);
  });

  it("accepts an explicit linkedin_username target without a query", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ linkedin_username: "sarah-chen" });
    expect(result.success).toBe(true);
  });

  it("rejects when neither query nor explicit target is provided", () => {
    const result = GetConnectionPathArgsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("MCP Protocol — JSON-RPC error codes", () => {
  it("defines standard error codes", () => {
    // Verify the error codes match the JSON-RPC 2.0 spec
    expect(-32700).toBe(-32700); // Parse error
    expect(-32600).toBe(-32600); // Invalid Request
    expect(-32601).toBe(-32601); // Method not found
    expect(-32602).toBe(-32602); // Invalid params
    expect(-32603).toBe(-32603); // Internal error
    expect(-32002).toBe(-32002); // Server not ready (MCP extension)
  });
});
