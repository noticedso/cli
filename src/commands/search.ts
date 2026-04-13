import { createClientFromEnv, type SearchHit, type ConnectionPath } from "../api-client.js";
import { resolveClientConfig } from "./config.js";

const DEFAULT_COLUMNS = ["name", "company", "source", "matched", "skills"];
const ALL_COLUMNS = ["name", "company", "source", "matched", "skills", "headline"];

interface SearchOptions {
  limit: string;
  offset: string;
  source?: string;
  sort?: string;
  columns?: string;
  paths?: boolean;
  json?: boolean;
  csv?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  noColor?: boolean;
}

export async function searchCommand(
  query: string,
  options: SearchOptions,
): Promise<void> {
  // TTY detection: auto-disable colors and spinner when piped
  const isTTY = process.stdout.isTTY ?? false;
  const noColor = options.noColor || !isTTY;
  const chalk = await loadChalk(noColor);

  // Spinner only in interactive mode
  let spinner: { stop: () => void } | null = null;
  if (isTTY && !options.json && !options.csv && !options.quiet) {
    const ora = await import("ora");
    spinner = ora.default({ text: "Searching...", color: "yellow" }).start();
  }

  try {
    resolveClientConfig();
    const client = createClientFromEnv();

    const limit = parseInt(options.limit, 10) || 25;
    const offset = parseInt(options.offset, 10) || 0;

    const result = await client.search(query, {
      limit,
      offset,
      paths: options.paths ?? true,
      sort: options.sort,
    });

    spinner?.stop();

    // Filter by source if specified
    let hits = result.hits;
    if (options.source) {
      const src = options.source.toLowerCase();
      hits = hits.filter((h) => h.source === src);
    }

    // ── JSON output ───────────────────────────────────────────────────
    if (options.json) {
      console.log(JSON.stringify({ ...result, hits }, null, 2));
      return;
    }

    // ── CSV output ────────────────────────────────────────────────────
    if (options.csv) {
      outputCsv(hits, resolveColumns(options));
      return;
    }

    // ── Quiet output (no headers, just tab-separated data) ────────────
    if (options.quiet) {
      for (const hit of hits) {
        const cols = resolveColumns(options);
        const values = cols.map((c) => getColumnValue(hit, c));
        console.log(values.join("\t"));
      }
      return;
    }

    // ── Standard table output ─────────────────────────────────────────
    if (hits.length === 0) {
      console.log(chalk.dim(`No results found for "${query}".`));
      return;
    }

    const cols = resolveColumns(options);

    // Header
    console.log(
      `\n${chalk.bold(String(hits.length))} result${hits.length !== 1 ? "s" : ""} for ${chalk.yellow(`"${query}"`)}` +
        (result.hasMore ? chalk.dim(` (more available)`) : ""),
    );
    console.log("");

    // Table
    const Table = (await import("cli-table3")).default;
    const table = new Table({
      head: cols.map((h) => chalk.yellow(columnLabel(h))),
      style: { head: [], border: [] },
      chars: {
        top: "─", "top-mid": "┬", "top-left": "┌", "top-right": "┐",
        bottom: "─", "bottom-mid": "┴", "bottom-left": "└", "bottom-right": "┘",
        left: "│", "left-mid": "├", mid: "─", "mid-mid": "┼",
        right: "│", "right-mid": "┤", middle: "│",
      },
      wordWrap: true,
    });

    for (const hit of hits) {
      const row = cols.map((col) => {
        const v = getColumnValue(hit, col);
        switch (col) {
          case "name": return formatName(hit, chalk);
          case "source": return hit.source === "github" ? chalk.cyan("GitHub") : chalk.blue("LinkedIn");
          case "matched": return chalk.dim(v);
          case "company": return v || chalk.dim("—");
          case "skills": return v || chalk.dim("—");
          case "headline": return v ? chalk.italic(v) : chalk.dim("—");
          default: return v;
        }
      });
      table.push(row);
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
    spinner?.stop();
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${msg}`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Column helpers
// ---------------------------------------------------------------------------

function resolveColumns(options: SearchOptions): string[] {
  if (options.columns) return options.columns.split(",").map((c) => c.trim());
  if (options.verbose) return ALL_COLUMNS;
  return DEFAULT_COLUMNS;
}

function columnLabel(col: string): string {
  switch (col) {
    case "name": return "Name";
    case "company": return "Company";
    case "source": return "Source";
    case "matched": return "Matched";
    case "skills": return "Skills";
    case "headline": return "Headline";
    default: return col;
  }
}

function getColumnValue(hit: SearchHit, col: string): string {
  switch (col) {
    case "name": {
      const parts = [hit.connection_first_name, hit.connection_last_name].filter(Boolean);
      return parts.join(" ") || hit.github_login || "";
    }
    case "company": return hit.connection_company ?? "";
    case "source": return hit.source;
    case "matched": return hit.matched_on;
    case "skills": return [...hit.profile_skills, ...hit.topics].slice(0, 3).join(", ");
    case "headline": return hit.profile_headline ?? "";
    default: return "";
  }
}

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

function outputCsv(hits: SearchHit[], columns: string[]): void {
  // Header
  console.log(columns.map((c) => csvQuote(columnLabel(c))).join(","));
  // Rows
  for (const hit of hits) {
    console.log(columns.map((c) => csvQuote(getColumnValue(hit, c))).join(","));
  }
}

function csvQuote(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Path display
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
    process.env["FORCE_COLOR"] = "0";
  }
  const chalk = await import("chalk");
  return chalk.default;
}
