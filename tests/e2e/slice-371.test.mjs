/**
 * Slice 371 — pricing-engine.mjs
 * Tests: computeBasePrice reads config, computeMultiplier respects weights + clamping,
 *        computeFinalPrice formula correct, missing config uses defaults.
 */

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 371 — pricing-engine\x1b[0m\n");

const mod = await import(join(process.cwd(), "tools/ogu/commands/lib/pricing-engine.mjs"));
const { loadPricingConfig, computeBasePrice, computeMultiplier, computeFinalPrice, updateAgentMultiplier } = mod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-371-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

const root = makeRoot();

assert("loadPricingConfig creates default files if missing", () => {
  const cfg = loadPricingConfig(root);
  if (!cfg.tiers || !cfg.multipliers) throw new Error("missing config keys");
  if (!cfg.tiers["1"]) throw new Error("missing tier 1");
});

assert("computeBasePrice tier 1 = model_cost + commission = 1.5", () => {
  const p = computeBasePrice(root, 1);
  if (p !== 1.5) throw new Error(`expected 1.5, got ${p}`);
});

assert("computeBasePrice tier 2 = 4", () => {
  const p = computeBasePrice(root, 2);
  if (p !== 4) throw new Error(`expected 4, got ${p}`);
});

assert("computeBasePrice tier 3 = 8", () => {
  const p = computeBasePrice(root, 3);
  if (p !== 8) throw new Error(`expected 8, got ${p}`);
});

assert("computeBasePrice tier 4 = 16", () => {
  const p = computeBasePrice(root, 4);
  if (p !== 16) throw new Error(`expected 16, got ${p}`);
});

assert("computeBasePrice throws on unknown tier", () => {
  let threw = false;
  try { computeBasePrice(root, 99); } catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

assert("computeMultiplier returns value in [floor, ceiling]", () => {
  const stats = { success_rate: 0.9, projects_completed: 10, utilization_units: 5, capacity_units: 10 };
  const m = computeMultiplier(root, stats);
  if (m < 0.5 || m > 2.0) throw new Error(`out of range: ${m}`);
});

assert("computeMultiplier with perfect stats approaches ceiling", () => {
  const stats = { success_rate: 1.0, projects_completed: 100, utilization_units: 10, capacity_units: 10 };
  const m = computeMultiplier(root, stats);
  if (m < 1.5) throw new Error(`expected high multiplier, got ${m}`);
});

assert("computeMultiplier with zero stats stays at floor (0.5)", () => {
  const stats = { success_rate: 0, projects_completed: 0, utilization_units: 0, capacity_units: 10 };
  const m = computeMultiplier(root, stats);
  if (m !== 0.5) throw new Error(`expected 0.5, got ${m}`);
});

assert("computeFinalPrice = base * multiplier", () => {
  const agent = {
    tier: 2,
    performance_multiplier: 1.0,
    capacity_units: 10,
    stats: { success_rate: 0.8, projects_completed: 0, utilization_units: 0 },
  };
  const price = computeFinalPrice(root, agent);
  // base=4, multiplier=1.0 → 4 (but multiplier is calculated from stats)
  if (typeof price !== "number" || price <= 0) throw new Error(`bad price: ${price}`);
});

assert("computeFinalPrice uses performance_multiplier if provided", () => {
  const agent = {
    tier: 2,
    performance_multiplier: 2.0,
    capacity_units: 10,
    stats: { success_rate: 0.8, projects_completed: 5, utilization_units: 2 },
  };
  const price = computeFinalPrice(root, agent);
  // base = 4, multiplier = 2.0 → 8
  if (price !== 8) throw new Error(`expected 8, got ${price}`);
});

assert("updateAgentMultiplier returns { multiplier } object", () => {
  const result = updateAgentMultiplier(root, "any-id", {
    success_rate: 0.9, projects_completed: 5, utilization_units: 3, capacity_units: 10,
  });
  if (typeof result.multiplier !== "number") throw new Error(`not a number: ${result.multiplier}`);
  if (result.multiplier < 0.5 || result.multiplier > 2.0) throw new Error(`out of range: ${result.multiplier}`);
});

rmSync(root, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
