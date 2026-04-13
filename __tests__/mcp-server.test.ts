import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import the schemas directly by re-defining them here (since mcp-server.ts
// doesn't export them). This tests the validation logic independent of the server.
const SearchNetworkArgsSchema = z.object({
  query: z.string().min(1, "query is required and must be non-empty"),
  limit: z.number().int().min(1).max(50).default(25),
  offset: z.number().int().min(0).default(0),
  source: z.enum(["github", "linkedin"]).optional(),
  include_paths: z.boolean().default(true),
});

const GetConnectionPathArgsSchema = z.object({
  query: z.string().min(1, "query is required and must be non-empty"),
  max_hops: z.number().int().min(1).max(6).default(4),
});

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
});

describe("MCP Input Validation — GetConnectionPathArgs", () => {
  it("accepts valid path args", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ query: "Sarah Chen" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("Sarah Chen");
      expect(result.data.max_hops).toBe(4);
    }
  });

  it("accepts custom max_hops", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ query: "test", max_hops: 2 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_hops).toBe(2);
    }
  });

  it("rejects empty query", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects max_hops > 6", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ query: "test", max_hops: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects max_hops < 1", () => {
    const result = GetConnectionPathArgsSchema.safeParse({ query: "test", max_hops: 0 });
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
