/**
 * compile-role.mjs
 * Usage: ogu compile:role <role> [--feature <slug>] [--fix] [--verbose]
 *
 * Runs domain compiler gates for a given agent role against the active
 * feature workspace. Produces pass/fail with OGU-style error codes.
 */

import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

const COMPILERS_ROOT = ".ogu/compilers";
const INDEX_PATH = ".ogu/compilers/index.json";

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
};
const ok   = (s) => `${C.green}✓${C.reset} ${s}`;
const fail = (s) => `${C.red}✗${C.reset} ${s}`;
const warn = (s) => `${C.yellow}⚠${C.reset} ${s}`;
const hdr  = (s) => `\n${C.bold}${C.cyan}${s}${C.reset}`;

// ── Gate runners ─────────────────────────────────────────────────────────────
function runGate(gate, workspaceDir, verbose) {
  const { id, type, severity } = gate;

  try {
    switch (type) {
      case "file_exists": {
        const pattern = gate.pattern;
        // Walk workspace looking for file matching pattern
        const found = findFile(workspaceDir, pattern);
        return { id, passed: found, severity, message: found ? null : `No file matching '${pattern}' found` };
      }

      case "file_contains": {
        const pattern = gate.pattern || gate.required_string;
        const files = getAllFiles(workspaceDir);
        const matched = files.some((f) => {
          try {
            return readFileSync(f, "utf8").toLowerCase().includes(pattern.toLowerCase());
          } catch { return false; }
        });
        return { id, passed: matched, severity, message: matched ? null : `No file contains required string: '${pattern}'` };
      }

      case "file_not_contains": {
        const banned = gate.banned_string;
        const files = getAllFiles(workspaceDir);
        const found = files.find((f) => {
          try {
            return readFileSync(f, "utf8").toLowerCase().includes(banned.toLowerCase());
          } catch { return false; }
        });
        return { id, passed: !found, severity, message: found ? `Found banned string '${banned}' in ${found}` : null };
      }

      case "output_count": {
        const files = getAllFiles(workspaceDir);
        const passed = files.length >= (gate.min_count || 1);
        return { id, passed, severity, message: passed ? null : `Expected at least ${gate.min_count} output files, found ${files.length}` };
      }

      default:
        return { id, passed: true, severity: "warn", message: `Unknown gate type '${type}' — skipped` };
    }
  } catch (err) {
    return { id, passed: false, severity, message: `Gate error: ${err.message}` };
  }
}

// ── File system helpers ───────────────────────────────────────────────────────
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".ogu", "coverage"]);
const SKIP_EXTS = /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|zip|gz|tar)$/i;

function getAllFiles(dir, results = []) {
  if (!existsSync(dir)) return results;
  const { readdirSync, statSync } = await import("node:fs").then ? { readdirSync: (await import("node:fs")).readdirSync, statSync: (await import("node:fs")).statSync } : require("node:fs");
  return _getAllFilesSync(dir, results);
}

function _getAllFilesSync(dir, results = []) {
  if (!existsSync(dir)) return results;
  let entries;
  try { entries = require("fs").readdirSync(dir); } catch { return results; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    try {
      const stat = require("fs").statSync(full);
      if (stat.isDirectory()) _getAllFilesSync(full, results);
      else if (!SKIP_EXTS.test(entry)) results.push(full);
    } catch { /* skip */ }
  }
  return results;
}

function findFile(dir, pattern) {
  const files = _getAllFilesSync(dir);
  const lp = pattern.toLowerCase();
  return files.some((f) => f.toLowerCase().includes(lp));
}

// ── Benchmark append ─────────────────────────────────────────────────────────
function appendBenchmark(root, role, results) {
  const benchPath = join(root, COMPILERS_ROOT, role, "benchmarks.jsonl");
  const entry = {
    ts: new Date().toISOString(),
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed && r.severity === "error").length,
    warned: results.filter((r) => !r.passed && r.severity === "warn").length,
    total: results.length,
  };
  try { appendFileSync(benchPath, JSON.stringify(entry) + "\n"); } catch { /* non-fatal */ }
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function compileRole() {
  const args = process.argv.slice(3);
  const role = args.find((a) => !a.startsWith("--"));
  const featureFlag = args.indexOf("--feature");
  const featureSlug = featureFlag !== -1 ? args[featureFlag + 1] : null;
  const verbose = args.includes("--verbose");
  const fix = args.includes("--fix");

  if (!role) {
    console.error("Usage: ogu compile:role <role> [--feature <slug>] [--verbose] [--fix]");
    console.error("\nAvailable roles: run 'ogu compile:role --list'");
    return 1;
  }

  // --list
  if (role === "--list") {
    const root = repoRoot();
    const index = readJsonSafe(join(root, INDEX_PATH));
    if (!index) { console.error("index.json not found"); return 1; }
    const byCategory = {};
    for (const [slug, meta] of Object.entries(index.compilers)) {
      (byCategory[meta.category] ||= []).push(slug);
    }
    for (const [cat, slugs] of Object.entries(byCategory)) {
      console.log(`\n${C.bold}${cat}${C.reset}`);
      slugs.forEach((s) => console.log(`  ${s}`));
    }
    return 0;
  }

  const root = repoRoot();

  // Load index
  const index = readJsonSafe(join(root, INDEX_PATH));
  if (!index) {
    console.error("OGU4001 index.json not found — run 'ogu compile:role' after setup");
    return 1;
  }

  // Resolve compiler
  const entry = index.compilers[role];
  if (!entry) {
    console.error(`OGU4002 Unknown role: '${role}'. Run 'ogu compile:role --list' to see all roles.`);
    return 1;
  }

  const compilerPath = join(root, entry.path);
  if (!existsSync(compilerPath)) {
    console.error(`OGU4003 compiler.json missing for role '${role}' at ${entry.path}`);
    return 1;
  }

  const compiler = readJsonSafe(compilerPath);
  if (!compiler) {
    console.error(`OGU4004 Failed to parse compiler.json for role '${role}'`);
    return 1;
  }

  // Resolve workspace
  let workspaceDir = root;
  if (featureSlug) {
    const featureDir = join(root, `docs/vault/04_Features/${featureSlug}`);
    if (!existsSync(featureDir)) {
      console.error(`OGU4005 Feature workspace not found: docs/vault/04_Features/${featureSlug}`);
      return 1;
    }
    workspaceDir = featureDir;
  }

  // Header
  console.log(hdr(`Domain Compiler — ${compiler.domain.display_name}`));
  console.log(`${C.dim}role: ${role}  |  category: ${compiler.domain.category}  |  tier: ${compiler.domain.min_tier}+${C.reset}`);
  if (featureSlug) console.log(`${C.dim}workspace: docs/vault/04_Features/${featureSlug}${C.reset}`);
  console.log();

  // Run gates
  const results = [];
  for (const gate of compiler.gates) {
    const result = runGate(gate, workspaceDir, verbose);
    results.push(result);

    if (result.passed) {
      console.log(ok(`[${gate.id}]`));
    } else if (result.severity === "error") {
      console.log(fail(`[${gate.id}] ${result.message}`));
      if (fix) console.log(`   ${C.dim}→ Fix: ${gate.description}${C.reset}`);
    } else {
      console.log(warn(`[${gate.id}] ${result.message}`));
    }
  }

  // Append benchmark
  appendBenchmark(root, role, results);

  // Summary
  const errors  = results.filter((r) => !r.passed && r.severity === "error");
  const warns   = results.filter((r) => !r.passed && r.severity === "warn");
  const passed  = results.filter((r) => r.passed);

  console.log();
  if (errors.length === 0) {
    console.log(`${C.green}${C.bold}PASS${C.reset}  ${passed.length}/${results.length} gates passed${warns.length ? `, ${warns.length} warning(s)` : ""}`);
    return 0;
  } else {
    console.log(`${C.red}${C.bold}FAIL${C.reset}  ${errors.length} error(s), ${warns.length} warning(s) — ${passed.length}/${results.length} gates passed`);
    if (!fix) console.log(`${C.dim}Run with --fix to see remediation hints${C.reset}`);
    return 1;
  }
}
