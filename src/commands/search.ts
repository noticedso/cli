import { createClientFromEnv, type SearchHit, type ConnectionPath } from "../api-client.js";
import { resolveClientConfig } from "./config.js";

interface SearchOptions {
  limit: string;
  offset: string;
  source?: string;
  paths?: boolean;
  json?: boolean;
  noColor?: boolean;
}

export async function searchCommand(
  query: string,
  options: SearchOptions,
): Promise<void> {
  const chalk = await loadChalk(options.noColor);
  const ora = await loadOra();
  const spinner = ora.default({ text: "Searching...", color: "yellow" }).start();

  try {
    resolveClientConfig();
    const client = createClientFromEnv();

    const limit = parseInt(options.limit, 10) || 25;
    const offset = parseInt(options.offset, 10) || 0;

    const result = await client.search(query, {
      limit,
      offset,
      paths: options.paths ?? true,
    });

    spinner.stop();

    // Filter by source if specified
    let hits = result.hits;
    if (options.source) {
      const src = options.source.toLowerCase();
      hits = hits.filter((h) => h.source === src);
    }

    if (options.json) {
      console.log(JSON.stringify({ ...result, hits }, null, 2));
      return;
    }

    if (hits.length === 0) {
      console.log(chalk.dim(`No results found for "${query}".`));
      return;
    }

    // Header
    console.log(
      `\n${chalk.bold(String(hits.length))} result${hits.length !== 1 ? "s" : ""} for ${chalk.yellow(`"${query}"`)}` +
        (result.hasMore ? chalk.dim(` (more available)`) : ""),
    );
    console.log("");

    // Table
    const Table = (await import("cli-table3")).default;
    const table = new Table({
      head: ["Name", "Company", "Source", "Matched", "Skills"].map((h) =>
        chalk.yellow(h),
      ),
      style: { head: [], border: [] },
      chars: {
        top: "─",
        "top-mid": "┬",
        "top-left": "┌",
        "top-right": "┐",
        bottom: "─",
        "bottom-mid": "┴",
        "bottom-left": "└",
        "bottom-right": "┘",
        left: "│",
        "left-mid": "├",
        mid: "─",
        "mid-mid": "┼",
        right: "│",
        "right-mid": "┤",
        middle: "│",
      },
      colWidths: [24, 20, 10, 12, 24],
      wordWrap: true,
    });

    for (const hit of hits) {
      const name = formatName(hit, chalk);
      const company = hit.connection_company || chalk.dim("—");
      const source = hit.source === "github"
        ? chalk.cyan("GitHub")
        : chalk.blue("LinkedIn");
      const matched = chalk.dim(hit.matched_on);
      const skills = [...hit.profile_skills, ...hit.topics]
        .slice(0, 3)
        .join(", ") || chalk.dim("—");

      table.push([name, company, source, matched, skills]);
    }

    console.log(table.toString());

    // Connection paths
    if (options.paths && result.paths.length > 0) {
      console.log(`\n${chalk.bold("Connection Paths:")}\n`);
      for (const path of result.paths) {
        printPath(path, chalk);
      }
    }

    // Pagination hint
    if (result.hasMore) {
      console.log(
        chalk.dim(`\nMore results available. Use --offset ${offset + limit} to see the next page.`),
      );
    }
  } catch (err) {
    spinner.stop();
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${msg}`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatName(hit: SearchHit, chalk: ChalkLike): string {
  const parts = [hit.connection_first_name, hit.connection_last_name].filter(Boolean);
  const name = parts.join(" ");
  const login = hit.github_login;

  if (name && login) return `${chalk.bold(name)}\n${chalk.dim(`@${login}`)}`;
  if (name) return chalk.bold(name);
  if (login) return chalk.bold(`@${login}`);
  return chalk.dim("—");
}

function printPath(path: ConnectionPath, chalk: ChalkLike): void {
  const profileMap = new Map(
    path.profiles.map((p) => [p.github_user_id, p]),
  );

  const startProfile = profileMap.get(path.from_user_id);
  const startName = startProfile?.name ?? startProfile?.login ?? "you";

  const chain: string[] = [chalk.green(startName)];

  for (const hop of path.hops) {
    const profile = profileMap.get(hop.to_user_id);
    const name = profile?.name ?? profile?.login ?? `#${hop.to_user_id}`;
    const edge = hop.edge_type === "linkedin"
      ? chalk.blue("─LinkedIn─▸")
      : chalk.dim("─collab─▸");
    chain.push(`${edge} ${chalk.bold(name)}`);
  }

  console.log(`  ${chain.join(" ")}`);
  console.log(chalk.dim(`  ${path.total_hops} hop${path.total_hops !== 1 ? "s" : ""}`));
  console.log("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChalkLike = any;

async function loadChalk(noColor?: boolean) {
  if (noColor) {
    // Force chalk to disable colors via env before importing
    process.env["FORCE_COLOR"] = "0";
  }
  const chalk = await import("chalk");
  return chalk.default;
}

async function loadOra() {
  return import("ora");
}
