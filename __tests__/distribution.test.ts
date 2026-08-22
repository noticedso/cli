import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("portable agent distribution", () => {
  const packageManifest = readJson("package.json");

  it("ships a conformant Agent Plugins 1.0 manifest", () => {
    const plugin = readJson("plugin.json");
    expect(plugin).toMatchObject({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "noticed",
      version: packageManifest.version,
      repository: "https://github.com/noticedso/cli",
      license: "MIT",
    });
    expect(Object.keys(plugin).sort()).toEqual(
      [
        "$schema",
        "author",
        "description",
        "homepage",
        "keywords",
        "license",
        "name",
        "repository",
        "version",
      ].sort(),
    );
  });

  it("ships a conformant portable MCP definition pinned to this release", () => {
    const mcp = readJson("mcp.json");
    expect(mcp).toEqual({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        noticed: {
          type: "stdio",
          command: "npx",
          args: ["-y", `@noticed/cli@${packageManifest.version}`, "mcp"],
        },
      },
    });
  });

  it("keeps the Claude Code compatibility manifest and MCP file aligned", () => {
    const plugin = readJson(".claude-plugin/plugin.json");
    const mcp = readJson(".mcp.json");
    expect(plugin).toMatchObject({
      $schema:
        "https://json.schemastore.org/claude-code-plugin-manifest.json",
      name: "noticed",
      version: packageManifest.version,
      skills: "./skills/",
      mcpServers: "./.mcp.json",
    });
    expect(mcp).toEqual({
      mcpServers: (readJson("mcp.json").mcpServers as Record<string, unknown>),
    });
  });

  it("uses portable Agent Skills frontmatter", () => {
    const skill = readFileSync(
      resolve(root, "skills/noticed-search/SKILL.md"),
      "utf8",
    );
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    expect(frontmatter).toContain("name: noticed-search");
    expect(frontmatter).toContain("description:");
    expect(frontmatter).toContain("license: MIT");
    expect(frontmatter).toContain('version: "0.3.2"');
    expect(frontmatter).toContain("allowed-tools: Bash(noticed:*)");
    expect(frontmatter).not.toContain("trigger:");
    expect(frontmatter).not.toMatch(/allowed-tools:\n\s+-/);
  });
});
