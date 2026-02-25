import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

const SUPPORTED_TYPES = ["sentry", "analytics", "uptime", "custom"];

const TYPE_FIELDS = {
  sentry: {
    required: ["api_token_env", "project_slug", "org_slug"],
    optional: ["dsn"],
  },
  analytics: {
    required: ["api_token_env", "endpoint", "site_id"],
    optional: [],
  },
  uptime: {
    required: ["endpoint"],
    optional: ["interval_seconds"],
  },
  custom: {
    required: ["endpoint", "api_token_env"],
    optional: ["format"],
  },
};

export async function observeSetup() {
  const args = process.argv.slice(3);
  const root = repoRoot();
  const configPath = join(root, ".ogu/OBSERVE.json");

  // Load or create config
  let config = readJsonSafe(configPath) || {
    version: 1,
    sources: [],
    releases: [],
    known_issues: [],
    last_observation: null,
  };

  // Handle subcommands
  const action = args[0];

  if (!action) {
    // Show current config
    showConfig(config);
    return 0;
  }

  switch (action) {
    case "--add": {
      const type = args[1];
      if (!type || !SUPPORTED_TYPES.includes(type)) {
        console.error(`  ERROR  Invalid type. Supported: ${SUPPORTED_TYPES.join(", ")}`);
        return 1;
      }

      const source = { type, enabled: true };
      const fields = TYPE_FIELDS[type];

      // Parse remaining args as --field value pairs
      for (const field of [...fields.required, ...fields.optional]) {
        const val = parseFlag(args, `--${field}`);
        if (val) {
          source[field] = field === "interval_seconds" ? parseInt(val, 10) : val;
        }
      }

      // Check required fields
      for (const field of fields.required) {
        if (!source[field]) {
          // Provide defaults
          if (field === "api_token_env") {
            source[field] = `${type.toUpperCase()}_API_TOKEN`;
            console.log(`  default  ${field} = ${source[field]} (set this env var)`);
          } else if (field === "interval_seconds") {
            source[field] = 300;
          } else {
            console.error(`  ERROR  Missing required field: --${field}`);
            console.error(`  Required fields for ${type}: ${fields.required.join(", ")}`);
            return 1;
          }
        }
      }

      // Set defaults for optional fields
      if (type === "uptime" && !source.interval_seconds) {
        source.interval_seconds = 300;
      }
      if (type === "custom" && !source.format) {
        source.format = "json";
      }

      config.sources.push(source);
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

      console.log(`  added    ${type} source`);
      for (const [key, val] of Object.entries(source)) {
        if (key !== "type" && key !== "enabled") {
          console.log(`           ${key}: ${val}`);
        }
      }
      return 0;
    }

    case "--remove": {
      const index = parseInt(args[1], 10);
      if (isNaN(index) || index < 0 || index >= config.sources.length) {
        console.error(`  ERROR  Invalid index. Valid range: 0-${config.sources.length - 1}`);
        return 1;
      }

      const removed = config.sources.splice(index, 1)[0];
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      console.log(`  removed  ${removed.type} source at index ${index}`);
      return 0;
    }

    case "--enable": {
      const index = parseInt(args[1], 10);
      if (isNaN(index) || index < 0 || index >= config.sources.length) {
        console.error(`  ERROR  Invalid index.`);
        return 1;
      }
      config.sources[index].enabled = true;
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      console.log(`  enabled  source ${index} (${config.sources[index].type})`);
      return 0;
    }

    case "--disable": {
      const index = parseInt(args[1], 10);
      if (isNaN(index) || index < 0 || index >= config.sources.length) {
        console.error(`  ERROR  Invalid index.`);
        return 1;
      }
      config.sources[index].enabled = false;
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      console.log(`  disabled source ${index} (${config.sources[index].type})`);
      return 0;
    }

    case "--release": {
      const gitSha = args[1];
      const feature = parseFlag(args, "--feature");
      if (!gitSha) {
        console.error("  ERROR  Usage: ogu observe:setup --release <git-sha> --feature <slug>");
        return 1;
      }
      config.releases.push({
        git_sha: gitSha,
        deployed_at: new Date().toISOString(),
        feature: feature || null,
      });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      console.log(`  release  ${gitSha.slice(0, 8)}${feature ? ` (${feature})` : ""}`);
      return 0;
    }

    default:
      console.error(`  ERROR  Unknown action: ${action}`);
      console.error("  Usage:");
      console.error("    ogu observe:setup                         Show config");
      console.error("    ogu observe:setup --add <type> [fields]   Add source");
      console.error("    ogu observe:setup --remove <index>        Remove source");
      console.error("    ogu observe:setup --enable <index>        Enable source");
      console.error("    ogu observe:setup --disable <index>       Disable source");
      console.error("    ogu observe:setup --release <sha>         Record a release");
      return 1;
  }
}

// ---------------------------------------------------------------------------

function showConfig(config) {
  if (config.sources.length === 0) {
    console.log("  No observation sources configured.");
    console.log("  Add one: ogu observe:setup --add <sentry|analytics|uptime|custom>");
    return;
  }

  console.log("  Observation sources:");
  for (let i = 0; i < config.sources.length; i++) {
    const s = config.sources[i];
    const status = s.enabled ? "ON" : "OFF";
    console.log(`  [${i}] ${s.type.padEnd(12)} ${status}`);
    for (const [key, val] of Object.entries(s)) {
      if (key !== "type" && key !== "enabled") {
        console.log(`      ${key}: ${val}`);
      }
    }
  }

  if (config.releases.length > 0) {
    console.log("");
    console.log(`  Releases tracked: ${config.releases.length}`);
    const latest = config.releases[config.releases.length - 1];
    console.log(`  Latest: ${latest.git_sha.slice(0, 8)} at ${latest.deployed_at}${latest.feature ? ` (${latest.feature})` : ""}`);
  }

  if (config.known_issues.length > 0) {
    console.log(`  Known issues: ${config.known_issues.length}`);
  }

  console.log(`  Last observation: ${config.last_observation || "never"}`);
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
