import { createClientFromEnv, type ConnectionPath, type SearchHit } from "../api-client.js";
import { resolveClientConfig } from "./config.js";

export interface PathOptions {
  li?: string;
  json?: boolean;
  noColor?: boolean;
}

export interface ResolvedPathTarget {
  /** Numeric github_user_id when the target is a numeric string. */
  to: number | null;
  /** LinkedIn username when --li is supplied. */
  li: string | null;
  /** GitHub login (without @) when the target is a non-numeric string. */
  login?: string;
}

export function resolvePathTarget(
  target: string,
  options: { li?: string },
): ResolvedPathTarget {
  // --li takes precedence — it skips the resolution step entirely.
  if (options.li) return { to: null, li: options.li };

  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error("Provide a target — a GitHub login, github_user_id, or --li <username>");
  }

  if (/^\d+$/.test(trimmed)) {
    return { to: parseInt(trimmed, 10), li: null };
  }

  const login = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return { to: null, li: null, login };
}

export async function pathCommand(target: string, options: PathOptions): Promise<void> {
  const isTTY = process.stdout.isTTY ?? false;
  const noColor = options.noColor || !isTTY;
  const chalk = await loadChalk(noColor);

  let spinner: { stop: () => void } | null = null;
  if (isTTY && !options.json) {
    const ora = await import("ora");
    spinner = ora.default({ text: "Finding path...", color: "yellow" }).start();
  }

  try {
    resolveClientConfig();
    const client = createClientFromEnv();

    const resolved = resolvePathTarget(target, { li: options.li });

    // If we only have a login, resolve it to a github_user_id by searching first.
    let to = resolved.to;
    let li = resolved.li;
    if (!to && !li && resolved.login) {
      const search = await client.search(resolved.login, { limit: 5, paths: false });
      const hit = pickBestLoginMatch(search.hits, resolved.login);
      if (!hit) {
        spinner?.stop();
        console.error(chalk.dim(`No GitHub or LinkedIn user found for "${resolved.login}".`));
        process.exit(1);
      }
      to = hit.github_user_id;
      li = hit.connection_linkedin_username;
    }

    const path = await client.path({ to, li });
    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify({ path }, null, 2));
      return;
    }

    if (!path) {
      console.log(chalk.dim("No path found."));
      return;
    }

    printPath(path, chalk);
  } catch (err) {
    spinner?.stop();
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${msg}`));
    process.exit(1);
  }
}

function pickBestLoginMatch(hits: SearchHit[], login: string): SearchHit | null {
  const lower = login.toLowerCase();
  // Prefer an exact GitHub login match, fall back to first hit with any github id.
  const exact = hits.find((h) => h.github_login?.toLowerCase() === lower);
  if (exact && (exact.github_user_id || exact.connection_linkedin_username)) return exact;
  const withId = hits.find((h) => h.github_user_id || h.connection_linkedin_username);
  return withId ?? null;
}

function printPath(path: ConnectionPath, chalk: ChalkLike): void {
  const profileMap = new Map(path.profiles.map((p) => [p.github_user_id, p]));

  const startProfile = profileMap.get(path.from_user_id);
  const startName = startProfile?.name ?? startProfile?.login ?? "you";

  const chain: string[] = [chalk.green(startName)];
  for (const hop of path.hops) {
    const profile = profileMap.get(hop.to_user_id);
    const name = profile?.name ?? profile?.login ?? `#${hop.to_user_id}`;
    const edge = hop.edge_type === "linkedin" ? chalk.blue("─LinkedIn─▸") : chalk.dim("─collab─▸");
    chain.push(`${edge} ${chalk.bold(name)}`);
  }

  console.log(`  ${chain.join(" ")}`);
  console.log(chalk.dim(`  ${path.total_hops} hop${path.total_hops !== 1 ? "s" : ""}`));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChalkLike = any;

async function loadChalk(noColor?: boolean) {
  if (noColor) process.env["FORCE_COLOR"] = "0";
  const chalk = await import("chalk");
  return chalk.default;
}
