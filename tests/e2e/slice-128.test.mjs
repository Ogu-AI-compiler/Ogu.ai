/**
 * Slice 128 — Impact Analyzer
 *

 * Impact analyzer: analyze impact of changes across the codebase.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 128 — Impact Analyzer\x1b[0m\n");

// ── Part 1: Impact Analyzer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Impact Analyzer\x1b[0m");

const iaLib = join(process.cwd(), "tools/ogu/commands/lib/impact-analyzer.mjs");
assert("impact-analyzer.mjs exists", () => {
  if (!existsSync(iaLib)) throw new Error("file missing");
});

const iaMod = await import(iaLib);

assert("createImpactAnalyzer returns analyzer", () => {
  if (typeof iaMod.createImpactAnalyzer !== "function") throw new Error("missing");
  const ia = iaMod.createImpactAnalyzer();
  if (typeof ia.addDependency !== "function") throw new Error("missing addDependency");
  if (typeof ia.analyzeImpact !== "function") throw new Error("missing analyzeImpact");
});

assert("analyzeImpact returns affected files", () => {
  const ia = iaMod.createImpactAnalyzer();
  ia.addDependency("auth.ts", "server.ts");
  ia.addDependency("server.ts", "app.ts");
  ia.addDependency("db.ts", "auth.ts");
  const impact = ia.analyzeImpact("db.ts");
  if (!impact.directDependents.includes("auth.ts")) throw new Error("missing direct dependent");
  if (!impact.transitiveDependents.includes("server.ts")) throw new Error("missing transitive");
});

assert("analyzeImpact returns empty for leaf node", () => {
  const ia = iaMod.createImpactAnalyzer();
  ia.addDependency("a.ts", "b.ts");
  const impact = ia.analyzeImpact("b.ts");
  if (impact.directDependents.length !== 0) throw new Error("leaf should have no dependents");
});

assert("getImpactScore computes severity", () => {
  const ia = iaMod.createImpactAnalyzer();
  ia.addDependency("core.ts", "auth.ts");
  ia.addDependency("core.ts", "api.ts");
  ia.addDependency("core.ts", "db.ts");
  ia.addDependency("auth.ts", "server.ts");
  const score = ia.getImpactScore("core.ts");
  if (typeof score !== "number") throw new Error("should return number");
  if (score <= 0) throw new Error("should be positive");
});

assert("listAllDependencies returns full graph", () => {
  const ia = iaMod.createImpactAnalyzer();
  ia.addDependency("a", "b");
  ia.addDependency("b", "c");
  const deps = ia.listAllDependencies();
  if (deps.length !== 2) throw new Error(`expected 2, got ${deps.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
