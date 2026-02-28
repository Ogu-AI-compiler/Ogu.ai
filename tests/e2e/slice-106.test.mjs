/**
 * Slice 106 — Audit Rotation + Audit Index Builder
 *
 * Audit rotation: rotate audit log daily to YYYY-MM-DD.jsonl.
 * Audit index builder: build index for fast lookup by feature/agent/date.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 106 — Audit Rotation + Audit Index Builder\x1b[0m\n");

// ── Part 1: Audit Rotation ──────────────────────────────

console.log("\x1b[36m  Part 1: Audit Rotation\x1b[0m");

const arLib = join(process.cwd(), "tools/ogu/commands/lib/audit-rotator.mjs");
assert("audit-rotator.mjs exists", () => {
  if (!existsSync(arLib)) throw new Error("file missing");
});

const arMod = await import(arLib);

assert("createAuditRotator returns rotator", () => {
  if (typeof arMod.createAuditRotator !== "function") throw new Error("missing");
  const ar = arMod.createAuditRotator({ dir: "/tmp/test-audit-rot" });
  if (typeof ar.rotate !== "function") throw new Error("missing rotate");
  if (typeof ar.listArchives !== "function") throw new Error("missing listArchives");
});

assert("rotate moves current.jsonl to dated archive", async () => {
  const dir = "/tmp/ogu-audit-rot-" + Date.now();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "current.jsonl"), '{"event":"test1"}\n{"event":"test2"}\n');
  const ar = arMod.createAuditRotator({ dir });
  const result = await ar.rotate("2026-02-27");
  if (!existsSync(join(dir, "2026-02-27.jsonl"))) throw new Error("archive not created");
  const archived = readFileSync(join(dir, "2026-02-27.jsonl"), "utf-8");
  if (!archived.includes("test1")) throw new Error("archive missing data");
  // current.jsonl should be empty or fresh
  const current = readFileSync(join(dir, "current.jsonl"), "utf-8");
  if (current.includes("test1")) throw new Error("current should be cleared");
  rmSync(dir, { recursive: true });
});

assert("rotate is no-op when current.jsonl is empty", async () => {
  const dir = "/tmp/ogu-audit-rot-empty-" + Date.now();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "current.jsonl"), "");
  const ar = arMod.createAuditRotator({ dir });
  const result = await ar.rotate("2026-02-27");
  if (result.rotated !== false) throw new Error("should not rotate empty log");
  rmSync(dir, { recursive: true });
});

assert("listArchives returns all dated files", async () => {
  const dir = "/tmp/ogu-audit-rot-list-" + Date.now();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "2026-02-25.jsonl"), "{}");
  writeFileSync(join(dir, "2026-02-26.jsonl"), "{}");
  writeFileSync(join(dir, "current.jsonl"), "");
  const ar = arMod.createAuditRotator({ dir });
  const archives = await ar.listArchives();
  if (archives.length !== 2) throw new Error(`expected 2, got ${archives.length}`);
  rmSync(dir, { recursive: true });
});

// ── Part 2: Audit Index Builder ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Audit Index Builder\x1b[0m");

const aiLib = join(process.cwd(), "tools/ogu/commands/lib/audit-index-builder.mjs");
assert("audit-index-builder.mjs exists", () => {
  if (!existsSync(aiLib)) throw new Error("file missing");
});

const aiMod = await import(aiLib);

assert("createAuditIndexBuilder returns builder", () => {
  if (typeof aiMod.createAuditIndexBuilder !== "function") throw new Error("missing");
  const ab = aiMod.createAuditIndexBuilder();
  if (typeof ab.index !== "function") throw new Error("missing index");
  if (typeof ab.query !== "function") throw new Error("missing query");
});

assert("index adds event to index", () => {
  const ab = aiMod.createAuditIndexBuilder();
  ab.index({ id: "e1", feature: "auth", agentId: "backend-dev", date: "2026-02-28", type: "task.start" });
  ab.index({ id: "e2", feature: "auth", agentId: "qa", date: "2026-02-28", type: "task.complete" });
  ab.index({ id: "e3", feature: "payments", agentId: "backend-dev", date: "2026-02-27", type: "task.start" });
  const byFeature = ab.query({ feature: "auth" });
  if (byFeature.length !== 2) throw new Error(`expected 2, got ${byFeature.length}`);
});

assert("query by agentId works", () => {
  const ab = aiMod.createAuditIndexBuilder();
  ab.index({ id: "e1", feature: "auth", agentId: "backend-dev", date: "2026-02-28", type: "task.start" });
  ab.index({ id: "e2", feature: "auth", agentId: "qa", date: "2026-02-28", type: "test.run" });
  const byAgent = ab.query({ agentId: "qa" });
  if (byAgent.length !== 1) throw new Error(`expected 1, got ${byAgent.length}`);
  if (byAgent[0].id !== "e2") throw new Error("wrong event");
});

assert("query by date range works", () => {
  const ab = aiMod.createAuditIndexBuilder();
  ab.index({ id: "e1", feature: "x", agentId: "a", date: "2026-02-25", type: "t" });
  ab.index({ id: "e2", feature: "x", agentId: "a", date: "2026-02-27", type: "t" });
  ab.index({ id: "e3", feature: "x", agentId: "a", date: "2026-02-28", type: "t" });
  const byDate = ab.query({ from: "2026-02-26", to: "2026-02-27" });
  if (byDate.length !== 1) throw new Error(`expected 1, got ${byDate.length}`);
  if (byDate[0].id !== "e2") throw new Error("wrong event");
});

assert("getStats returns index statistics", () => {
  const ab = aiMod.createAuditIndexBuilder();
  ab.index({ id: "e1", feature: "auth", agentId: "dev", date: "2026-02-28", type: "t" });
  ab.index({ id: "e2", feature: "pay", agentId: "dev", date: "2026-02-28", type: "t" });
  const stats = ab.getStats();
  if (stats.totalEvents !== 2) throw new Error(`expected 2, got ${stats.totalEvents}`);
  if (stats.features.length !== 2) throw new Error(`expected 2 features, got ${stats.features.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
