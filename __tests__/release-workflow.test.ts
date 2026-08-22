import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(import.meta.dirname, "../.github/workflows/release.yml"),
  "utf8",
);

describe("npm release workflow", () => {
  it("publishes through trusted publishing without a repository token", () => {
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("npm install --global npm@11.5.1");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow).not.toContain("secrets.NPM_TOKEN");

    const npmUpgrade = workflow.indexOf("npm install --global npm@11.5.1");
    const npmPublish = workflow.indexOf(
      "npm publish --provenance --access public",
    );
    expect(npmUpgrade).toBeGreaterThan(-1);
    expect(npmPublish).toBeGreaterThan(npmUpgrade);
  });
});
