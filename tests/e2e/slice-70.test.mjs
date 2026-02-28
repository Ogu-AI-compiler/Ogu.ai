/**
 * Slice 70 — Telemetry Exporter + Health Probe
 *
 * Telemetry: export metrics in Prometheus/OpenTelemetry text format.
 * Health probe: deep health check with dependency resolution.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice70-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ current_task: "auth" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
  dailyLimit: 100, monthlyLimit: 2000, dailySpent: 10, monthlySpent: 50, lastReset: "2026-02-28",
}));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 70 — Telemetry Exporter + Health Probe\x1b[0m\n");

// ── Part 1: Telemetry Exporter ──────────────────────────────

console.log("\x1b[36m  Part 1: Telemetry Exporter\x1b[0m");

const telLib = join(process.cwd(), "tools/ogu/commands/lib/telemetry-exporter.mjs");
assert("telemetry-exporter.mjs exists", () => {
  if (!existsSync(telLib)) throw new Error("file missing");
});

const telMod = await import(telLib);

assert("exportPrometheus formats metrics correctly", () => {
  if (typeof telMod.exportPrometheus !== "function") throw new Error("missing");
  const metrics = {
    "ogu_gates_passed": { type: "counter", value: 42 },
    "ogu_build_duration_seconds": { type: "gauge", value: 12.5 },
  };
  const output = telMod.exportPrometheus(metrics);
  if (typeof output !== "string") throw new Error("should return string");
  if (!output.includes("ogu_gates_passed 42")) throw new Error("should include counter");
  if (!output.includes("ogu_build_duration_seconds 12.5")) throw new Error("should include gauge");
});

assert("exportPrometheus adds TYPE comments", () => {
  const metrics = {
    "total_requests": { type: "counter", value: 100 },
  };
  const output = telMod.exportPrometheus(metrics);
  if (!output.includes("# TYPE total_requests counter")) throw new Error("should have TYPE comment");
});

assert("exportJSON formats metrics as JSON", () => {
  if (typeof telMod.exportJSON !== "function") throw new Error("missing");
  const metrics = { "test_metric": { type: "gauge", value: 99 } };
  const output = telMod.exportJSON(metrics);
  const parsed = JSON.parse(output);
  if (!parsed.metrics) throw new Error("should have metrics key");
  if (!parsed.timestamp) throw new Error("should have timestamp");
});

assert("collectSystemMetrics returns system data", () => {
  if (typeof telMod.collectSystemMetrics !== "function") throw new Error("missing");
  const m = telMod.collectSystemMetrics({ root: tmp });
  if (typeof m !== "object") throw new Error("should return object");
  if (!m["ogu_state_exists"]) throw new Error("should check state existence");
});

// ── Part 2: Health Probe ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Health Probe\x1b[0m");

const probeLib = join(process.cwd(), "tools/ogu/commands/lib/health-probe.mjs");
assert("health-probe.mjs exists", () => {
  if (!existsSync(probeLib)) throw new Error("file missing");
});

const probeMod = await import(probeLib);

assert("runHealthProbe returns structured result", () => {
  if (typeof probeMod.runHealthProbe !== "function") throw new Error("missing");
  const result = probeMod.runHealthProbe({ root: tmp });
  if (typeof result.healthy !== "boolean") throw new Error("missing healthy");
  if (!Array.isArray(result.checks)) throw new Error("missing checks array");
  if (typeof result.score !== "number") throw new Error("missing score");
});

assert("checks include required subsystems", () => {
  const result = probeMod.runHealthProbe({ root: tmp });
  const names = result.checks.map(c => c.name);
  if (!names.includes("state")) throw new Error("missing state check");
  if (!names.includes("audit")) throw new Error("missing audit check");
});

assert("each check has status and details", () => {
  const result = probeMod.runHealthProbe({ root: tmp });
  for (const check of result.checks) {
    if (!check.name) throw new Error("check missing name");
    if (!["pass", "warn", "fail"].includes(check.status)) {
      throw new Error(`invalid check status: ${check.status}`);
    }
  }
});

assert("score is 0-100 range", () => {
  const result = probeMod.runHealthProbe({ root: tmp });
  if (result.score < 0 || result.score > 100) throw new Error(`score out of range: ${result.score}`);
});

assert("PROBE_CHECKS lists all check names", () => {
  if (!probeMod.PROBE_CHECKS) throw new Error("missing");
  if (!Array.isArray(probeMod.PROBE_CHECKS)) throw new Error("should be array");
  if (probeMod.PROBE_CHECKS.length < 3) throw new Error("should have at least 3 checks");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
