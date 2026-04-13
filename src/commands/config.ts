interface ConfigOptions {
  setUrl?: string;
  setKey?: string;
  show?: boolean;
}

/**
 * Resolve client configuration from flags → env → config store, setting
 * process.env so that createClientFromEnv picks it up.
 */
export function resolveClientConfig(): void {
  // CLI flags are handled by commander and placed on the parent command's opts.
  // We read from process.env directly since commander already sets them.
  // Order of precedence: CLI flag > env var > config file

  // Check for config file fallback
  try {
    const configPath = getConfigPath();
    if (configPath) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs");
      if (fs.existsSync(configPath)) {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, string>;
        if (!process.env["NOTICED_API_URL"] && raw["api_url"]) {
          process.env["NOTICED_API_URL"] = raw["api_url"];
        }
        if (!process.env["NOTICED_API_KEY"] && raw["api_key"]) {
          process.env["NOTICED_API_KEY"] = raw["api_key"];
        }
      }
    }
  } catch {
    // Config file is optional
  }
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  const chalk = (await import("chalk")).default;
  const fs = await import("node:fs");
  const path = await import("node:path");

  const configPath = getConfigPath();
  if (!configPath) {
    console.error(chalk.red("Cannot determine config directory."));
    process.exit(1);
  }

  // Ensure directory exists
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Read existing config
  let config: Record<string, string> = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, string>;
    }
  } catch {
    config = {};
  }

  // Set values
  if (options.setUrl) {
    config["api_url"] = options.setUrl;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    console.log(chalk.green(`API URL set to ${options.setUrl}`));
  }

  if (options.setKey) {
    config["api_key"] = options.setKey;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    console.log(chalk.green("API key saved."));
  }

  if (options.show || (!options.setUrl && !options.setKey)) {
    console.log(chalk.bold("\nnoticed CLI Configuration\n"));
    console.log(`  Config file:  ${chalk.dim(configPath)}`);
    console.log(
      `  API URL:      ${config["api_url"] || process.env["NOTICED_API_URL"] || chalk.dim("(not set)")}`,
    );
    console.log(
      `  API Key:      ${config["api_key"] || process.env["NOTICED_API_KEY"] ? chalk.green("••••••••") : chalk.dim("(not set)")}`,
    );
    console.log(
      `\n  ${chalk.dim("Set via: noticed config --set-url <url> --set-key <key>")}`,
    );
    console.log(
      `  ${chalk.dim("Or use NOTICED_API_URL and NOTICED_API_KEY environment variables.")}`,
    );
    console.log("");
  }
}

function getConfigPath(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const home = process.env["HOME"] ?? process.env["USERPROFILE"];
  const base = xdg ?? (home ? `${home}/.config` : null);
  if (!base) return "";
  return `${base}/noticed/config.json`;
}
