import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the helpers that resolve a target string into a path() argument set.
// The full pathCommand wraps these with chalk/console output; the key behavior
// (how do we map a CLI target to {to,li}?) lives in the helpers.

import { resolvePathTarget, type ResolvedPathTarget } from "../src/commands/path.js";

describe("resolvePathTarget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a github_user_id when target is a numeric string", () => {
    const t = resolvePathTarget("12345", { li: undefined });
    expect(t).toEqual({ to: 12345, li: null } satisfies ResolvedPathTarget);
  });

  it("strips leading @ from a github login", () => {
    const t = resolvePathTarget("@sarahml", { li: undefined });
    expect(t).toEqual({ to: null, li: null, login: "sarahml" } satisfies ResolvedPathTarget);
  });

  it("treats a bare login as a login lookup", () => {
    const t = resolvePathTarget("sarahml", { li: undefined });
    expect(t).toEqual({ to: null, li: null, login: "sarahml" } satisfies ResolvedPathTarget);
  });

  it("uses --li option when provided", () => {
    const t = resolvePathTarget("", { li: "sarah-chen" });
    expect(t).toEqual({ to: null, li: "sarah-chen" } satisfies ResolvedPathTarget);
  });

  it("--li wins over a positional target when both are given", () => {
    const t = resolvePathTarget("@sarahml", { li: "sarah-chen" });
    expect(t).toEqual({ to: null, li: "sarah-chen" } satisfies ResolvedPathTarget);
  });

  it("throws when no target and no --li are provided", () => {
    expect(() => resolvePathTarget("", { li: undefined })).toThrow(/target/i);
  });
});
