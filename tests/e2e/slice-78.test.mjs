/**
 * Slice 78 — Canary Routing + Org Evolution
 *
 * Canary: graduated rollout with traffic routing and metrics.
 * Org evolution: propose, validate, and apply org structure changes.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 78 — Canary Routing + Org Evolution\x1b[0m\n");

// ── Part 1: Canary Routing ──────────────────────────────

console.log("\x1b[36m  Part 1: Canary Routing\x1b[0m");

const canLib = join(process.cwd(), "tools/ogu/commands/lib/canary.mjs");
assert("canary.mjs exists", () => {
  if (!existsSync(canLib)) throw new Error("file missing");
});

const canMod = await import(canLib);

assert("createCanary returns canary manager", () => {
  if (typeof canMod.createCanary !== "function") throw new Error("missing");
  const c = canMod.createCanary({ name: "new-model", percentage: 10 });
  if (typeof c.route !== "function") throw new Error("missing route");
  if (typeof c.metrics !== "function") throw new Error("missing metrics");
  if (typeof c.promote !== "function") throw new Error("missing promote");
  if (typeof c.rollback !== "function") throw new Error("missing rollback");
});

assert("route returns canary or stable based on percentage", () => {
  const c = canMod.createCanary({ name: "test", percentage: 50 });
  let canaryCount = 0;
  for (let i = 0; i < 100; i++) {
    const target = c.route(`req-${i}`);
    if (target === "canary") canaryCount++;
  }
  // With 50% routing, should get roughly 40-60
  if (canaryCount < 20 || canaryCount > 80) throw new Error(`unexpected canary distribution: ${canaryCount}`);
});

assert("recordResult tracks success/failure", () => {
  const c = canMod.createCanary({ name: "test", percentage: 10 });
  c.recordResult("canary", true);
  c.recordResult("canary", true);
  c.recordResult("canary", false);
  c.recordResult("stable", true);
  const m = c.metrics();
  if (m.canary.total !== 3) throw new Error(`expected 3 canary, got ${m.canary.total}`);
  if (m.canary.success !== 2) throw new Error(`expected 2 success, got ${m.canary.success}`);
  if (m.stable.total !== 1) throw new Error(`expected 1 stable, got ${m.stable.total}`);
});

assert("promote sets percentage to 100", () => {
  const c = canMod.createCanary({ name: "test", percentage: 10 });
  c.promote();
  const status = c.getStatus();
  if (status.percentage !== 100) throw new Error(`expected 100, got ${status.percentage}`);
  if (status.state !== "promoted") throw new Error(`expected promoted, got ${status.state}`);
});

assert("rollback sets percentage to 0", () => {
  const c = canMod.createCanary({ name: "test", percentage: 10 });
  c.rollback();
  const status = c.getStatus();
  if (status.percentage !== 0) throw new Error(`expected 0, got ${status.percentage}`);
  if (status.state !== "rolled_back") throw new Error(`expected rolled_back, got ${status.state}`);
});

// ── Part 2: Org Evolution ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Org Evolution\x1b[0m");

const orgLib = join(process.cwd(), "tools/ogu/commands/lib/org-evolution.mjs");
assert("org-evolution.mjs exists", () => {
  if (!existsSync(orgLib)) throw new Error("file missing");
});

const orgMod = await import(orgLib);

assert("proposeEvolution creates evolution proposal", () => {
  if (typeof orgMod.proposeEvolution !== "function") throw new Error("missing");
  const proposal = orgMod.proposeEvolution({
    current: { roles: ["dev", "qa"], agents: 2 },
    changes: [{ type: "add_role", role: "devops" }],
  });
  if (!proposal.id) throw new Error("missing id");
  if (proposal.status !== "proposed") throw new Error("should be proposed");
});

assert("validateEvolution checks feasibility", () => {
  if (typeof orgMod.validateEvolution !== "function") throw new Error("missing");
  const proposal = orgMod.proposeEvolution({
    current: { roles: ["dev"], agents: 1 },
    changes: [{ type: "add_role", role: "qa" }],
  });
  const result = orgMod.validateEvolution(proposal);
  if (typeof result.valid !== "boolean") throw new Error("missing valid field");
});

assert("applyEvolution applies changes to org", () => {
  if (typeof orgMod.applyEvolution !== "function") throw new Error("missing");
  const current = { roles: ["dev", "qa"], agents: 2 };
  const proposal = orgMod.proposeEvolution({
    current,
    changes: [{ type: "add_role", role: "devops" }],
  });
  const newOrg = orgMod.applyEvolution(current, proposal);
  if (!newOrg.roles.includes("devops")) throw new Error("should include new role");
});

assert("diffWithCurrent shows what changed", () => {
  if (typeof orgMod.diffWithCurrent !== "function") throw new Error("missing");
  const current = { roles: ["dev", "qa"], agents: 2 };
  const proposed = { roles: ["dev", "qa", "devops"], agents: 3 };
  const diff = orgMod.diffWithCurrent(current, proposed);
  if (!diff.addedRoles || diff.addedRoles.length === 0) throw new Error("should show added roles");
});

assert("EVOLUTION_TYPES exported", () => {
  if (!orgMod.EVOLUTION_TYPES) throw new Error("missing");
  if (!Array.isArray(orgMod.EVOLUTION_TYPES)) throw new Error("should be array");
  if (!orgMod.EVOLUTION_TYPES.includes("add_role")) throw new Error("missing add_role");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
