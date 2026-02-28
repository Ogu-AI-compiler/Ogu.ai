/**
 * Slice 65 — Feature Flag System + A/B Test Framework
 *
 * Feature flags: toggle features on/off with rollout percentages.
 * A/B test: variant assignment and result tracking.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice65-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 65 — Feature Flag System + A/B Test Framework\x1b[0m\n");

// ── Part 1: Feature Flags ──────────────────────────────

console.log("\x1b[36m  Part 1: Feature Flags\x1b[0m");

const ffLib = join(process.cwd(), "tools/ogu/commands/lib/feature-flags.mjs");
assert("feature-flags.mjs exists", () => {
  if (!existsSync(ffLib)) throw new Error("file missing");
});

const ffMod = await import(ffLib);

assert("createFlagManager returns manager", () => {
  if (typeof ffMod.createFlagManager !== "function") throw new Error("missing");
  const mgr = ffMod.createFlagManager();
  if (typeof mgr.setFlag !== "function") throw new Error("missing setFlag");
  if (typeof mgr.isEnabled !== "function") throw new Error("missing isEnabled");
  if (typeof mgr.listFlags !== "function") throw new Error("missing listFlags");
});

assert("setFlag and isEnabled work together", () => {
  const mgr = ffMod.createFlagManager();
  mgr.setFlag("dark-mode", { enabled: true });
  if (!mgr.isEnabled("dark-mode")) throw new Error("should be enabled");
  mgr.setFlag("dark-mode", { enabled: false });
  if (mgr.isEnabled("dark-mode")) throw new Error("should be disabled");
});

assert("isEnabled returns false for unknown flags", () => {
  const mgr = ffMod.createFlagManager();
  if (mgr.isEnabled("nonexistent")) throw new Error("unknown should be disabled");
});

assert("setFlag supports rollout percentage", () => {
  const mgr = ffMod.createFlagManager();
  mgr.setFlag("beta-feature", { enabled: true, rolloutPercent: 50 });
  const flags = mgr.listFlags();
  const flag = flags.find(f => f.id === "beta-feature");
  if (!flag) throw new Error("should list the flag");
  if (flag.rolloutPercent !== 50) throw new Error(`expected 50%, got ${flag.rolloutPercent}`);
});

assert("removeFlag deletes a flag", () => {
  const mgr = ffMod.createFlagManager();
  mgr.setFlag("temp", { enabled: true });
  if (typeof mgr.removeFlag !== "function") throw new Error("missing removeFlag");
  mgr.removeFlag("temp");
  if (mgr.isEnabled("temp")) throw new Error("should be removed");
});

// ── Part 2: A/B Test Framework ──────────────────────────────

console.log("\n\x1b[36m  Part 2: A/B Test Framework\x1b[0m");

const abLib = join(process.cwd(), "tools/ogu/commands/lib/ab-test.mjs");
assert("ab-test.mjs exists", () => {
  if (!existsSync(abLib)) throw new Error("file missing");
});

const abMod = await import(abLib);

assert("createExperiment returns experiment", () => {
  if (typeof abMod.createExperiment !== "function") throw new Error("missing");
  const exp = abMod.createExperiment({
    id: "prompt-v2",
    variants: [
      { id: "control", weight: 50 },
      { id: "treatment", weight: 50 },
    ],
  });
  if (typeof exp.assign !== "function") throw new Error("missing assign");
  if (typeof exp.recordResult !== "function") throw new Error("missing recordResult");
  if (typeof exp.getResults !== "function") throw new Error("missing getResults");
});

assert("assign returns deterministic variant for same subject", () => {
  const exp = abMod.createExperiment({
    id: "test",
    variants: [{ id: "a", weight: 50 }, { id: "b", weight: 50 }],
  });
  const v1 = exp.assign("user-123");
  const v2 = exp.assign("user-123");
  if (v1 !== v2) throw new Error("should be deterministic for same subject");
});

assert("assign distributes across variants", () => {
  const exp = abMod.createExperiment({
    id: "dist-test",
    variants: [{ id: "a", weight: 50 }, { id: "b", weight: 50 }],
  });
  const assignments = new Set();
  for (let i = 0; i < 100; i++) {
    assignments.add(exp.assign(`user-${i}`));
  }
  if (assignments.size < 2) throw new Error("should have both variants assigned");
});

assert("recordResult and getResults track outcomes", () => {
  const exp = abMod.createExperiment({
    id: "metrics",
    variants: [{ id: "a", weight: 50 }, { id: "b", weight: 50 }],
  });
  exp.recordResult("user-1", { success: true, latency: 120 });
  exp.recordResult("user-2", { success: false, latency: 500 });
  const results = exp.getResults();
  if (results.totalSamples !== 2) throw new Error(`expected 2 samples, got ${results.totalSamples}`);
});

assert("getResults breaks down by variant", () => {
  const exp = abMod.createExperiment({
    id: "breakdown",
    variants: [{ id: "a", weight: 50 }, { id: "b", weight: 50 }],
  });
  for (let i = 0; i < 20; i++) {
    exp.recordResult(`user-${i}`, { success: true });
  }
  const results = exp.getResults();
  if (!results.byVariant) throw new Error("should have byVariant");
  if (typeof results.byVariant.a !== "object" && typeof results.byVariant.b !== "object") {
    throw new Error("should break down by variant");
  }
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
