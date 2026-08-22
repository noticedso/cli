import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowDirectory = resolve(import.meta.dirname, "../.github/workflows");

describe("GitHub workflow action runtimes", () => {
  for (const filename of readdirSync(workflowDirectory).filter((name) =>
    name.endsWith(".yml"),
  )) {
    it(`${filename} does not use Node 20-based checkout or setup-node actions`, () => {
      const workflow = readFileSync(
        resolve(workflowDirectory, filename),
        "utf8",
      );
      expect(workflow).not.toContain("actions/checkout@v4");
      expect(workflow).not.toContain("actions/setup-node@v4");
    });
  }

  it("uses the trusted default checkout in the privileged registry workflow", () => {
    const workflow = readFileSync(
      resolve(workflowDirectory, "mcp-registry.yml"),
      "utf8",
    );
    const checkoutConfiguration =
      workflow.match(
        /- uses: actions\/checkout@v6([\s\S]*?)(?=\n\s+- (?:name:|uses:|run:))/,
      )?.[1] ?? "";
    expect(checkoutConfiguration).not.toContain("ref:");
    expect(workflow).not.toContain("github.event.workflow_run.head_sha");
    expect(workflow).not.toContain("github.event.workflow_run.head_branch");
  });
});
