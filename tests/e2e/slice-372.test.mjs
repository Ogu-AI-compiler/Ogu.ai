/**
 * Slice 372 — marketplace-allocator.mjs
 * Tests: hireAgent creates allocation, reduces available capacity,
 *        throws on over-capacity, releaseAgent restores capacity.
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

console.log("\n\x1b[1mSlice 372 — marketplace-allocator\x1b[0m\n");

const storeMod = await import(join(process.cwd(), "tools/ogu/commands/lib/agent-store.mjs"));
const allocMod = await import(join(process.cwd(), "tools/ogu/commands/lib/marketplace-allocator.mjs"));
const genMod   = await import(join(process.cwd(), "tools/ogu/commands/lib/agent-generator.mjs"));

const { saveAgent } = storeMod;
const { hireAgent, releaseAgent, getAvailableCapacity, listProjectAllocations, listAgentAllocations } = allocMod;
const { generateAgent } = genMod;

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-372-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function createAgent(root, capacityUnits = 10) {
  const profile = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: Math.random() * 99999 });
  profile.capacity_units = capacityUnits;
  return saveAgent(root, profile);
}

const root = makeRoot();

assert("hireAgent creates allocation with correct fields", () => {
  const agent = createAgent(root, 10);
  const alloc = hireAgent(root, {
    agentId:         agent.agent_id,
    projectId:       "proj-001",
    roleSlot:        "backend-lead",
    allocationUnits: 3,
    priorityLevel:   70,
  });
  if (!alloc.allocation_id)     throw new Error("missing allocation_id");
  if (alloc.agent_id !== agent.agent_id) throw new Error("wrong agent_id");
  if (alloc.allocation_units !== 3)      throw new Error(`expected 3 units, got ${alloc.allocation_units}`);
  if (alloc.status !== "active")         throw new Error(`expected active, got ${alloc.status}`);
});

assert("getAvailableCapacity reduces after hire", () => {
  const agent = createAgent(root, 10);
  hireAgent(root, { agentId: agent.agent_id, projectId: "proj-x", roleSlot: "dev", allocationUnits: 4 });
  const avail = getAvailableCapacity(root, agent.agent_id);
  if (avail !== 6) throw new Error(`expected 6, got ${avail}`);
});

assert("hireAgent throws on over-capacity", () => {
  const agent = createAgent(root, 5);
  let threw = false;
  try {
    hireAgent(root, { agentId: agent.agent_id, projectId: "proj-y", roleSlot: "dev", allocationUnits: 10 });
  } catch (e) {
    threw = true;
    if (!e.message.includes("insufficient capacity")) throw new Error(`wrong error: ${e.message}`);
  }
  if (!threw) throw new Error("expected throw");
});

assert("releaseAgent restores capacity", () => {
  const agent = createAgent(root, 8);
  const alloc = hireAgent(root, { agentId: agent.agent_id, projectId: "proj-z", roleSlot: "dev", allocationUnits: 5 });
  const before = getAvailableCapacity(root, agent.agent_id);
  releaseAgent(root, alloc.allocation_id);
  const after = getAvailableCapacity(root, agent.agent_id);
  if (after <= before) throw new Error(`capacity not restored: before=${before} after=${after}`);
});

assert("releaseAgent throws for unknown allocation", () => {
  let threw = false;
  try { releaseAgent(root, "fake-id"); }
  catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

assert("listProjectAllocations returns active allocations for project", () => {
  const agent = createAgent(root, 10);
  const projId = `proj-${randomUUID().slice(0,6)}`;
  hireAgent(root, { agentId: agent.agent_id, projectId: projId, roleSlot: "dev", allocationUnits: 2 });
  const allocs = listProjectAllocations(root, projId);
  if (allocs.length !== 1) throw new Error(`expected 1, got ${allocs.length}`);
  if (allocs[0].project_id !== projId) throw new Error("wrong project_id");
});

assert("listAgentAllocations returns all allocations for agent", () => {
  const agent = createAgent(root, 10);
  hireAgent(root, { agentId: agent.agent_id, projectId: "pa", roleSlot: "dev", allocationUnits: 1 });
  hireAgent(root, { agentId: agent.agent_id, projectId: "pb", roleSlot: "dev", allocationUnits: 2 });
  const allocs = listAgentAllocations(root, agent.agent_id);
  if (allocs.length < 2) throw new Error(`expected ≥2, got ${allocs.length}`);
});

assert("released allocation excluded from listProjectAllocations", () => {
  const agent = createAgent(root, 10);
  const projId = `proj-${randomUUID().slice(0,6)}`;
  const alloc = hireAgent(root, { agentId: agent.agent_id, projectId: projId, roleSlot: "dev", allocationUnits: 3 });
  releaseAgent(root, alloc.allocation_id);
  const allocs = listProjectAllocations(root, projId);
  if (allocs.length !== 0) throw new Error(`expected 0 after release, got ${allocs.length}`);
});

rmSync(root, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
