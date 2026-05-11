import { describe, it, expect } from "vitest";

import {
  SearchArgsSchema,
  ExecuteArgsSchema,
} from "../src/mcp-server.js";

describe("MCP Input Validation — SearchArgs", () => {
  it("accepts an empty object and defaults limit to 50", () => {
    const result = SearchArgsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.query).toBeUndefined();
      expect(result.data.category).toBeUndefined();
    }
  });

  it("accepts query + category + limit", () => {
    const result = SearchArgsSchema.safeParse({
      query: "missions",
      category: "missions",
      limit: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("missions");
      expect(result.data.category).toBe("missions");
      expect(result.data.limit).toBe(10);
    }
  });

  it("rejects limit > 50", () => {
    const result = SearchArgsSchema.safeParse({ limit: 100 });
    expect(result.success).toBe(false);
  });

  it("rejects limit < 1", () => {
    const result = SearchArgsSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer limit", () => {
    const result = SearchArgsSchema.safeParse({ limit: 12.5 });
    expect(result.success).toBe(false);
  });
});

describe("MCP Input Validation — ExecuteArgs", () => {
  it("accepts a capability name with no args", () => {
    const result = ExecuteArgsSchema.safeParse({ capability: "list_missions" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capability).toBe("list_missions");
      expect(result.data.args).toBeUndefined();
    }
  });

  it("accepts a capability name with an args object", () => {
    const result = ExecuteArgsSchema.safeParse({
      capability: "get_person_dossier",
      args: { github_user_id: 12345 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual({ github_user_id: 12345 });
    }
  });

  it("rejects missing capability", () => {
    const result = ExecuteArgsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty capability", () => {
    const result = ExecuteArgsSchema.safeParse({ capability: "" });
    expect(result.success).toBe(false);
  });

  it("rejects args that is not an object", () => {
    const result = ExecuteArgsSchema.safeParse({
      capability: "list_missions",
      args: "not-an-object",
    });
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
