import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { createMigrationEngine } from "./lib/config-migrate.mjs";

export async function migrate() {
  const args = process.argv.slice(3);
  const dryRun = args.includes("--dry-run");
  const root = repoRoot();

  // Wire config migration engine (Phase 3E)
  const migrationEngine = createMigrationEngine();
  migrationEngine.register('1', '2', (config) => {
    // Example transform: ensure ogu_version field
    if (!config.ogu_version) config.ogu_version = 2;
    return config;
  });

  const statePath = join(root, ".ogu/STATE.json");
  const state = readJsonSafe(statePath);

  if (!state) {
    console.error("  ERROR  No .ogu/STATE.json found. Run `ogu init` first.");
    return 1;
  }

  const currentVersion = state.ogu_version || 1;
  const targetVersion = getLatestVersion();

  if (currentVersion >= targetVersion) {
    console.log(`  version  ${currentVersion} (latest)`);
    console.log("  No migration needed.");
    return 0;
  }

  console.log(`  current  v${currentVersion}`);
  console.log(`  target   v${targetVersion}`);
  console.log(`  mode     ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  // Backup before migration
  if (!dryRun) {
    const backupDir = join(root, `.ogu/backup_v${currentVersion}`);
    if (!existsSync(backupDir)) {
      console.log(`  backup   .ogu/backup_v${currentVersion}/`);
      mkdirSync(backupDir, { recursive: true });
      backupOguDir(root, backupDir);
    } else {
      console.log(`  backup   already exists, skipping`);
    }
  }

  // Run migrations sequentially
  let version = currentVersion;
  const results = [];

  while (version < targetVersion) {
    const nextVersion = version + 1;
    const migrateFn = migrations[`v${version}_to_v${nextVersion}`];

    if (!migrateFn) {
      console.error(`  ERROR  No migration path from v${version} to v${nextVersion}`);
      return 1;
    }

    console.log(`  migrate  v${version} → v${nextVersion}`);
    const result = migrateFn(root, dryRun);
    results.push({ from: version, to: nextVersion, ...result });

    for (const change of result.changes) {
      const prefix = dryRun ? "  (dry)" : "  apply";
      console.log(`  ${prefix}   ${change}`);
    }

    version = nextVersion;
  }

  // Update state version
  if (!dryRun) {
    state.ogu_version = targetVersion;
    state.last_migration = new Date().toISOString();
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  }

  console.log("");
  console.log(`  result   ${dryRun ? "would migrate" : "migrated"} v${currentVersion} → v${targetVersion}`);
  console.log(`  changes  ${results.reduce((a, r) => a + r.changes.length, 0)} total`);

  return 0;
}

// ---------------------------------------------------------------------------

function getLatestVersion() {
  return 2; // Increment as new migrations are added
}

const migrations = {
  v1_to_v2: (root, dryRun) => {
    const changes = [];

    // 1. Add type field to GRAPH.json edges
    const graphPath = join(root, ".ogu/GRAPH.json");
    const graph = readJsonSafe(graphPath);
    if (graph && graph.edges) {
      let edgesUpdated = 0;
      for (const edge of graph.edges) {
        if (!edge.type) {
          edge.type = "static";
          edgesUpdated++;
        }
      }
      if (edgesUpdated > 0) {
        graph.version = 2;
        if (!dryRun) {
          writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n", "utf-8");
        }
        changes.push(`GRAPH.json: added type field to ${edgesUpdated} edges, version → 2`);
      }
    }

    // 2. Add ogu_version to STATE.json
    const statePath = join(root, ".ogu/STATE.json");
    const state = readJsonSafe(statePath);
    if (state && !state.ogu_version) {
      if (!dryRun) {
        state.ogu_version = 2;
        writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
      }
      changes.push("STATE.json: added ogu_version field");
    }

    // 3. Add production_validated to existing patterns
    const patternsPath = join(root, "../../.ogu/global-memory/patterns.json");
    const altPatternsPath = join(homedir(), ".ogu/global-memory/patterns.json");
    const actualPatternsPath = existsSync(patternsPath) ? patternsPath : existsSync(altPatternsPath) ? altPatternsPath : null;

    if (actualPatternsPath) {
      const store = readJsonSafe(actualPatternsPath);
      if (store?.patterns) {
        let patternsUpdated = 0;
        for (const pattern of store.patterns) {
          if (pattern.production_validated === undefined) {
            pattern.production_validated = false;
            patternsUpdated++;
          }
        }
        if (patternsUpdated > 0) {
          if (!dryRun) {
            writeFileSync(actualPatternsPath, JSON.stringify(store, null, 2) + "\n", "utf-8");
          }
          changes.push(`patterns.json: added production_validated to ${patternsUpdated} patterns`);
        }
      }
    }

    // 4. Ensure THEME.json exists (default to minimal if missing)
    const themePath = join(root, ".ogu/THEME.json");
    if (!existsSync(themePath)) {
      if (!dryRun) {
        const defaultTheme = {
          version: 1,
          mood: "minimal",
          description: "Clean, modern, whitespace-heavy. Default theme.",
          references: [],
          constraints: {
            dark_mode: false,
            high_contrast: false,
            animations: "subtle",
            typography_feel: "clean-sans",
            color_palette: "neutral",
          },
          generated_tokens: {},
        };
        writeFileSync(themePath, JSON.stringify(defaultTheme, null, 2) + "\n", "utf-8");
      }
      changes.push("THEME.json: created with default minimal theme");
    }

    // 5. Ensure gate checkpointing directory structure
    const gateStatePath = join(root, ".ogu/GATE_STATE.json");
    if (!existsSync(gateStatePath)) {
      changes.push("GATE_STATE.json: will be created on first gates run");
    }

    if (changes.length === 0) {
      changes.push("no changes needed — already at v2 structure");
    }

    return { changes };
  },
};

// ---------------------------------------------------------------------------

function backupOguDir(root, backupDir) {
  const oguDir = join(root, ".ogu");
  const filesToBackup = [
    "STATE.json", "GRAPH.json", "CONTEXT.md", "LOCK.json",
    "METRICS.json", "PROFILE.json", "MEMORY.md", "THEME.json",
    "OBSERVE.json", "GATE_STATE.json",
  ];

  for (const file of filesToBackup) {
    const src = join(oguDir, file);
    if (existsSync(src)) {
      const dest = join(backupDir, file);
      writeFileSync(dest, readFileSync(src));
    }
  }

  // Backup memory directory
  const memDir = join(oguDir, "memory");
  if (existsSync(memDir)) {
    const destMemDir = join(backupDir, "memory");
    mkdirSync(destMemDir, { recursive: true });
    try {
      for (const f of readdirSync(memDir)) {
        writeFileSync(join(destMemDir, f), readFileSync(join(memDir, f)));
      }
    } catch { /* skip */ }
  }
}
