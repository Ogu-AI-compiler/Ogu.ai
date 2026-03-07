/**
 * Slice 370 — agent-store.mjs
 * Tests: saveAgent writes file + updates index, loadAgent reads it,
 *        listAgents filters work, sequential ID generation.
 */

import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 370 — agent-store\x1b[0m\n");

const mod = await import(join(process.cwd(), "tools/ogu/commands/lib/agent-store.mjs"));
const { saveAgent, loadAgent, listAgents, searchAgents, updateAgentStats, generateAgentId } = mod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-370-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function makeProfile(overrides = {}) {
  return {
    agent_id:           null,
    name:               "Test Agent",
    role:               "Engineer",
    specialty:          "backend",
    tier:               2,
    dna:                { work_style: "async-first" },
    skills:             ["debugging","testing"],
    system_prompt:      "## Identity\nTest",
    capacity_units:     10,
    base_price:         4,
    performance_multiplier: 1.0,
    stats:              { success_rate: 0.8, projects_completed: 0, utilization_units: 0 },
    created_at:         new Date().toISOString(),
    status:             "available",
    ...overrides,
  };
}

const root = makeRoot();

assert("generateAgentId returns agent_NNNN format", () => {
  const id = generateAgentId(root);
  if (!/^agent_\d{4}$/.test(id)) throw new Error(`bad format: ${id}`);
});

assert("saveAgent writes file and assigns agent_id", () => {
  const p = makeProfile();
  const saved = saveAgent(root, p);
  if (!saved.agent_id) throw new Error("no agent_id assigned");
  if (!/^agent_\d{4}$/.test(saved.agent_id)) throw new Error(`bad id: ${saved.agent_id}`);
  const file = join(root, ".ogu/marketplace/agents", `${saved.agent_id}.json`);
  if (!existsSync(file)) throw new Error("file not written");
});

assert("saveAgent updates index", () => {
  const p = makeProfile({ name: "Index Test" });
  const saved = saveAgent(root, p);
  const entries = listAgents(root);
  const found = entries.find(e => e.agent_id === saved.agent_id);
  if (!found) throw new Error("not in index");
});

assert("loadAgent reads back the profile", () => {
  const p = makeProfile({ name: "Loaded Agent", role: "QA", specialty: "frontend" });
  const saved = saveAgent(root, p);
  const loaded = loadAgent(root, saved.agent_id);
  if (!loaded) throw new Error("loadAgent returned null");
  if (loaded.name !== "Loaded Agent") throw new Error(`name mismatch: ${loaded.name}`);
});

assert("loadAgent returns null for unknown id", () => {
  const r = loadAgent(root, "agent_9999");
  if (r !== null) throw new Error("expected null");
});

assert("sequential IDs increment", () => {
  const root2 = makeRoot();
  const a = saveAgent(root2, makeProfile());
  const b = saveAgent(root2, makeProfile());
  const numA = parseInt(a.agent_id.replace("agent_", ""), 10);
  const numB = parseInt(b.agent_id.replace("agent_", ""), 10);
  if (numB !== numA + 1) throw new Error(`expected sequential: ${a.agent_id} → ${b.agent_id}`);
});

assert("listAgents filter by role", () => {
  const root3 = makeRoot();
  saveAgent(root3, makeProfile({ role: "PM",       specialty: "product" }));
  saveAgent(root3, makeProfile({ role: "QA",       specialty: "frontend" }));
  saveAgent(root3, makeProfile({ role: "Engineer", specialty: "backend" }));
  const pms = listAgents(root3, { role: "PM" });
  if (pms.length !== 1) throw new Error(`expected 1 PM, got ${pms.length}`);
});

assert("listAgents filter by tier", () => {
  const root4 = makeRoot();
  saveAgent(root4, makeProfile({ tier: 1 }));
  saveAgent(root4, makeProfile({ tier: 2 }));
  saveAgent(root4, makeProfile({ tier: 2 }));
  const tier2 = listAgents(root4, { tier: 2 });
  if (tier2.length !== 2) throw new Error(`expected 2, got ${tier2.length}`);
});

assert("listAgents filter by available", () => {
  const root5 = makeRoot();
  saveAgent(root5, makeProfile({ status: "available" }));
  saveAgent(root5, makeProfile({ status: "unavailable" }));
  const avail = listAgents(root5, { available: true });
  if (avail.length !== 1) throw new Error(`expected 1, got ${avail.length}`);
});

assert("searchAgents returns full profiles", () => {
  const root6 = makeRoot();
  saveAgent(root6, makeProfile({ role: "Security", specialty: "security-audit" }));
  const results = searchAgents(root6, { role: "Security" });
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
  if (!results[0].system_prompt) throw new Error("missing system_prompt in result");
});

assert("updateAgentStats merges stats", () => {
  const root7 = makeRoot();
  const saved = saveAgent(root7, makeProfile());
  const updated = updateAgentStats(root7, saved.agent_id, { projects_completed: 5 });
  if (updated.stats.projects_completed !== 5) throw new Error(`expected 5, got ${updated.stats.projects_completed}`);
  if (updated.stats.success_rate !== 0.8) throw new Error("success_rate was overwritten");
});

rmSync(root, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
