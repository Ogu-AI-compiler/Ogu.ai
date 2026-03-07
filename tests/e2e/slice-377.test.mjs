/**
 * Slice 377 — marketplace.ts Studio API
 * Tests via unit-level imports (no HTTP server needed).
 * Tests that createMarketplaceApi() exports a Hono app with correct route behavior
 * by testing the underlying lib functions directly.
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
async function assertAsync(label, fn) {
  try { await fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 377 — marketplace API (lib-level)\x1b[0m\n");

// Test via the underlying libs (same as API routes use)
const storeMod  = await import(join(process.cwd(), "tools/ogu/commands/lib/agent-store.mjs"));
const genMod    = await import(join(process.cwd(), "tools/ogu/commands/lib/agent-generator.mjs"));
const priceMod  = await import(join(process.cwd(), "tools/ogu/commands/lib/pricing-engine.mjs"));
const allocMod  = await import(join(process.cwd(), "tools/ogu/commands/lib/marketplace-allocator.mjs"));
const patMod    = await import(join(process.cwd(), "tools/ogu/commands/lib/pattern-store.mjs"));

const { saveAgent, listAgents, loadAgent } = storeMod;
const { generateAgent } = genMod;
const { computeFinalPrice } = priceMod;
const { hireAgent, listProjectAllocations } = allocMod;
const { listPatterns, savePattern } = patMod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-377-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

// GET /agents equivalent: listAgents + computeFinalPrice
await assertAsync("GET /agents — returns array with price field", async () => {
  const root = makeRoot();
  const profile = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: 42 });
  saveAgent(root, profile);

  const entries = listAgents(root);
  const agents = entries.map(e => {
    const agent = loadAgent(root, e.agent_id);
    return { ...agent, price: computeFinalPrice(root, agent) };
  }).filter(Boolean);

  if (!Array.isArray(agents))       throw new Error("not an array");
  if (agents.length === 0)          throw new Error("empty array");
  if (typeof agents[0].price !== "number") throw new Error("price is not a number");
  if (agents[0].price <= 0)        throw new Error(`price must be positive, got ${agents[0].price}`);
  rmSync(root, { recursive: true, force: true });
});

// POST /agents/generate equivalent
await assertAsync("POST /agents/generate — saves and returns agent", async () => {
  const root = makeRoot();
  const profile = generateAgent({ role: "PM", specialty: "product", tier: 1, seed: 99 });
  const saved = saveAgent(root, profile);

  if (!saved.agent_id)   throw new Error("no agent_id");
  if (saved.role !== "PM") throw new Error("wrong role");
  rmSync(root, { recursive: true, force: true });
});

// POST /hire equivalent
await assertAsync("POST /hire — creates allocation", async () => {
  const root = makeRoot();
  const profile = generateAgent({ role: "QA", specialty: "frontend", tier: 2, seed: 7 });
  const saved = saveAgent(root, profile);

  const alloc = hireAgent(root, {
    agentId:         saved.agent_id,
    projectId:       "proj-377",
    roleSlot:        "qa-lead",
    allocationUnits: 2,
    priorityLevel:   60,
  });

  if (!alloc.allocation_id) throw new Error("no allocation_id");
  if (alloc.status !== "active") throw new Error(`wrong status: ${alloc.status}`);
  rmSync(root, { recursive: true, force: true });
});

// GET /allocations equivalent
await assertAsync("GET /allocations — filtered by project", async () => {
  const root = makeRoot();
  const profile = generateAgent({ role: "Architect", specialty: "distributed", tier: 3, seed: 55 });
  const saved = saveAgent(root, profile);
  const projId = `proj-${randomUUID().slice(0,6)}`;
  hireAgent(root, { agentId: saved.agent_id, projectId: projId, roleSlot: "arch", allocationUnits: 2 });

  const allocs = listProjectAllocations(root, projId);
  if (!Array.isArray(allocs))   throw new Error("not array");
  if (allocs.length !== 1)      throw new Error(`expected 1, got ${allocs.length}`);
  if (allocs[0].project_id !== projId) throw new Error("wrong project_id");
  rmSync(root, { recursive: true, force: true });
});

// 400 on over-capacity
await assertAsync("POST /hire — 400 equivalent on over-capacity", async () => {
  const root = makeRoot();
  const profile = generateAgent({ role: "Doc", specialty: "docs-api", tier: 1, seed: 11 });
  const saved   = saveAgent(root, profile);
  saved.capacity_units = 3;
  saveAgent(root, saved); // re-save with lower capacity

  let threw = false;
  try {
    hireAgent(root, { agentId: saved.agent_id, projectId: "p", roleSlot: "doc", allocationUnits: 99 });
  } catch (e) {
    threw = true;
    if (!e.message.includes("insufficient")) throw new Error(`wrong error: ${e.message}`);
  }
  if (!threw) throw new Error("should throw on over-capacity");
  rmSync(root, { recursive: true, force: true });
});

// GET /patterns equivalent
await assertAsync("GET /patterns — returns patterns array", async () => {
  const root = makeRoot();
  const p = {
    pattern_id:       randomUUID(),
    task_type:        "build",
    context_signature:["framework:react"],
    failure_signals:  [],
    resolution_summary:"",
    confidence:       0.5,
    success_count:    0,
    failure_count:    0,
    active:           true,
    created_at:       new Date().toISOString(),
    last_used_at:     null,
  };
  savePattern(root, p);
  const all = listPatterns(root);
  if (!Array.isArray(all)) throw new Error("not array");
  if (all.length !== 1)    throw new Error(`expected 1, got ${all.length}`);
  rmSync(root, { recursive: true, force: true });
});

// POST /agents/populate equivalent
await assertAsync("POST /agents/populate — generates multiple agents", async () => {
  const root = makeRoot();
  const roles      = ["PM","Architect","Engineer","QA","DevOps","Security","Doc"];
  const specialties = ["frontend","backend","mobile","data","platform","security-audit","ai-ml","product","docs-api","distributed"];
  const tiers = [1,2,3,4];
  const count = 10;
  const created = [];

  for (let i = 0; i < count; i++) {
    const role      = roles[i % roles.length];
    const specialty = specialties[i % specialties.length];
    const tier      = tiers[i % tiers.length];
    const profile   = generateAgent({ role, specialty, tier, seed: i * 7919 + 42 });
    const saved     = saveAgent(root, profile);
    created.push(saved.agent_id);
  }

  if (created.length !== count) throw new Error(`expected ${count}, got ${created.length}`);
  const all = listAgents(root);
  if (all.length !== count) throw new Error(`index has ${all.length}, expected ${count}`);
  rmSync(root, { recursive: true, force: true });
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
