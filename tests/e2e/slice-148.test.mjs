/**
 * Slice 148 — Feature Flag Manager + A/B Test Router
 *
 * Feature Flag Manager: toggle features on/off with rules.
 * A/B Test Router: route requests to experiment variants.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 148 — Feature Flag Manager + A/B Test Router\x1b[0m\n");

console.log("\x1b[36m  Part 1: Feature Flag Manager\x1b[0m");

const ffLib = join(process.cwd(), "tools/ogu/commands/lib/feature-flag-manager.mjs");
assert("feature-flag-manager.mjs exists", () => { if (!existsSync(ffLib)) throw new Error("file missing"); });

const ffMod = await import(ffLib);

assert("createFeatureFlagManager returns manager", () => {
  if (typeof ffMod.createFeatureFlagManager !== "function") throw new Error("missing");
  const mgr = ffMod.createFeatureFlagManager();
  if (typeof mgr.setFlag !== "function") throw new Error("missing setFlag");
  if (typeof mgr.isEnabled !== "function") throw new Error("missing isEnabled");
});

assert("setFlag and isEnabled works", () => {
  const mgr = ffMod.createFeatureFlagManager();
  mgr.setFlag("dark-mode", true);
  mgr.setFlag("beta-feature", false);
  if (!mgr.isEnabled("dark-mode")) throw new Error("should be enabled");
  if (mgr.isEnabled("beta-feature")) throw new Error("should be disabled");
});

assert("isEnabled returns false for undefined flags", () => {
  const mgr = ffMod.createFeatureFlagManager();
  if (mgr.isEnabled("nonexistent")) throw new Error("should be false");
});

assert("listFlags returns all flags", () => {
  const mgr = ffMod.createFeatureFlagManager();
  mgr.setFlag("a", true);
  mgr.setFlag("b", false);
  const flags = mgr.listFlags();
  if (flags.length !== 2) throw new Error(`expected 2, got ${flags.length}`);
});

console.log("\n\x1b[36m  Part 2: A/B Test Router\x1b[0m");

const abLib = join(process.cwd(), "tools/ogu/commands/lib/ab-test-router.mjs");
assert("ab-test-router.mjs exists", () => { if (!existsSync(abLib)) throw new Error("file missing"); });

const abMod = await import(abLib);

assert("createABTestRouter returns router", () => {
  if (typeof abMod.createABTestRouter !== "function") throw new Error("missing");
  const router = abMod.createABTestRouter();
  if (typeof router.addExperiment !== "function") throw new Error("missing addExperiment");
  if (typeof router.assign !== "function") throw new Error("missing assign");
});

assert("assign returns a valid variant", () => {
  const router = abMod.createABTestRouter();
  router.addExperiment({ name: "button-color", variants: ["red", "blue", "green"], weights: [50, 30, 20] });
  const variant = router.assign("button-color", "user-123");
  if (!["red", "blue", "green"].includes(variant)) throw new Error(`invalid variant: ${variant}`);
});

assert("assign is deterministic for same user", () => {
  const router = abMod.createABTestRouter();
  router.addExperiment({ name: "layout", variants: ["a", "b"], weights: [50, 50] });
  const v1 = router.assign("layout", "user-abc");
  const v2 = router.assign("layout", "user-abc");
  if (v1 !== v2) throw new Error("should be deterministic");
});

assert("getResults returns assignment counts", () => {
  const router = abMod.createABTestRouter();
  router.addExperiment({ name: "test", variants: ["x", "y"], weights: [50, 50] });
  for (let i = 0; i < 10; i++) router.assign("test", `user-${i}`);
  const results = router.getResults("test");
  if (typeof results !== "object") throw new Error("should return object");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
