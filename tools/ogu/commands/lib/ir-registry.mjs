// Central IR loading and querying.
// Loads Plan.json, builds full IR index with normalized identifiers.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeIR } from "./normalize-ir.mjs";

const IGNORE_DIRS = new Set(["node_modules", ".git", ".ogu", "dist", "build", ".next", "coverage"]);

/**
 * Load Plan.json for a feature and build an IR registry.
 * Returns null if Plan.json doesn't exist or has no tasks.
 */
export function loadIR(root, slug) {
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  if (!existsSync(planPath)) return null;

  let plan;
  try {
    plan = JSON.parse(readFileSync(planPath, "utf-8"));
  } catch {
    return null;
  }

  const tasks = plan.tasks || [];
  if (tasks.length === 0) return null;

  const allOutputs = tasks.flatMap((t) => (t.outputs || []).map(normalizeIR));
  const allInputs = tasks.flatMap((t) => (t.inputs || []).map(normalizeIR));
  const allResources = tasks.flatMap((t) => (t.resources || []).map(normalizeIR));
  const allSpecSections = [...new Set(tasks.map((t) => t.spec_section).filter(Boolean))];

  const outputToTask = {};
  for (const t of tasks) {
    for (const o of t.outputs || []) {
      outputToTask[normalizeIR(o)] = t.id;
    }
  }

  return {
    tasks,
    allOutputs,
    allInputs,
    allResources,
    allSpecSections,
    outputToTask,
    hasOutput(identifier) {
      return this.allOutputs.includes(normalizeIR(identifier));
    },
    hasIR() {
      return tasks.some((t) => t.outputs && t.outputs.length > 0);
    },
  };
}

/**
 * Scan the repo for pre-existing outputs (files, tokens, routes, schemas, contracts).
 * Returns a Set of normalized IR identifiers.
 */
export function scanPreExisting(root) {
  const preExisting = new Set();

  // FILE:* — every file already in the repo (limited to common source dirs)
  const sourceDirs = ["src", "apps", "packages", "lib", "app", "components", "pages"];
  for (const dir of sourceDirs) {
    const fullDir = join(root, dir);
    if (existsSync(fullDir)) {
      scanFilesRecursive(fullDir, root, preExisting);
    }
  }

  // TOKEN:* — if design.tokens.json exists
  const tokensPath = join(root, "design.tokens.json");
  if (existsSync(tokensPath)) {
    try {
      const tokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
      scanTokenPaths(tokens, "", preExisting);
    } catch { /* skip */ }
  }

  // ROUTE:* — if App Router or route files exist
  for (const routeDir of [join(root, "app"), join(root, "src/app")]) {
    if (existsSync(routeDir)) {
      scanRoutes(routeDir, routeDir, preExisting);
    }
  }

  // SCHEMA:* — if Prisma schema exists
  const prismaPath = join(root, "prisma/schema.prisma");
  if (existsSync(prismaPath)) {
    try {
      const schema = readFileSync(prismaPath, "utf-8");
      const models = schema.match(/^model\s+(\w+)/gm);
      if (models) {
        for (const m of models) {
          const name = m.replace(/^model\s+/, "");
          preExisting.add(normalizeIR(`SCHEMA:${name}`));
        }
      }
    } catch { /* skip */ }
  }

  // CONTRACT:* — if .contract.json files exist
  const contractsDir = join(root, "docs/vault/02_Contracts");
  if (existsSync(contractsDir)) {
    try {
      const entries = readdirSync(contractsDir);
      for (const entry of entries) {
        if (entry.endsWith(".contract.json")) {
          const name = entry.replace(".contract.json", "");
          preExisting.add(normalizeIR(`CONTRACT:${name}`));
        }
      }
    } catch { /* skip */ }
  }

  return preExisting;
}

function scanFilesRecursive(dir, root, set) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanFilesRecursive(fullPath, root, set);
      } else {
        const relPath = fullPath.slice(root.length + 1);
        set.add(normalizeIR(`FILE:${relPath}`));
      }
    }
  } catch { /* skip */ }
}

function scanTokenPaths(obj, prefix, set) {
  if (!obj || typeof obj !== "object") return;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      scanTokenPaths(value, path, set);
    } else {
      set.add(normalizeIR(`TOKEN:${path}`));
    }
  }
}

function scanRoutes(dir, baseDir, set) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanRoutes(fullPath, baseDir, set);
      } else if (/^page\.(tsx?|jsx?)$/.test(entry.name)) {
        const relRoute = dir.slice(baseDir.length).replace(/\\/g, "/") || "/";
        const route = relRoute
          .replace(/\/\([^)]+\)/g, "")
          .replace(/\/\[\.\.\.([^\]]+)\]/g, "/:$1")
          .replace(/\/\[([^\]]+)\]/g, "/:$1");
        set.add(normalizeIR(`ROUTE:${route || "/"}`));
      }
    }
  } catch { /* skip */ }
}
