/**
 * marketplace-allocator.mjs — Slice 372
 * Manages capacity allocations for marketplace agents.
 * Storage:
 *   .ogu/marketplace/allocations/{allocation_id}.json
 *   .ogu/marketplace/allocations/index.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadAgent, saveAgent } from "./agent-store.mjs";
import { getMarketplaceDir } from "./runtime-paths.mjs";

function allocDir(root) {
  return join(getMarketplaceDir(root), "allocations");
}

function allocIndexPath(root) {
  return join(allocDir(root), "index.json");
}

function ensureDirs(root) {
  mkdirSync(allocDir(root), { recursive: true });
}

function readAllocIndex(root) {
  const p = allocIndexPath(root);
  if (!existsSync(p)) return { allocations: [] };
  try { return JSON.parse(readFileSync(p, "utf-8")); }
  catch { return { allocations: [] }; }
}

function writeAllocIndex(root, idx) {
  ensureDirs(root);
  writeFileSync(allocIndexPath(root), JSON.stringify(idx, null, 2) + "\n", "utf-8");
}

function readAlloc(root, allocationId) {
  const p = join(allocDir(root), `${allocationId}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")); }
  catch { return null; }
}

function writeAlloc(root, alloc) {
  ensureDirs(root);
  writeFileSync(
    join(allocDir(root), `${alloc.allocation_id}.json`),
    JSON.stringify(alloc, null, 2) + "\n",
    "utf-8"
  );
}

/**
 * getAvailableCapacity(root, agentId) → number
 */
export function getAvailableCapacity(root, agentId) {
  const agent = loadAgent(root, agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  const idx = readAllocIndex(root);
  const used = idx.allocations
    .filter(a => a.agent_id === agentId && a.status === "active")
    .reduce((sum, a) => sum + (a.allocation_units || 0), 0);
  return agent.capacity_units - used;
}

/**
 * hireAgent(root, { projectId, agentId, roleSlot, allocationUnits, priorityLevel }) → Allocation
 * Throws if agent capacity exceeded.
 */
export function hireAgent(root, { projectId, agentId, roleSlot, allocationUnits, priorityLevel }) {
  ensureDirs(root);
  const units = Number(allocationUnits) || 1;
  const available = getAvailableCapacity(root, agentId);
  if (units > available) {
    throw new Error(`Agent ${agentId} has insufficient capacity: need ${units}, available ${available}`);
  }

  const alloc = {
    allocation_id:   randomUUID(),
    project_id:      projectId,
    agent_id:        agentId,
    role_slot:       roleSlot,
    allocation_units: units,
    priority_level:  priorityLevel ?? 50,
    status:          "active",
    hired_at:        new Date().toISOString(),
  };

  writeAlloc(root, alloc);

  const idx = readAllocIndex(root);
  idx.allocations.push({
    allocation_id:   alloc.allocation_id,
    agent_id:        agentId,
    project_id:      projectId,
    allocation_units: units,
    status:          "active",
  });
  writeAllocIndex(root, idx);

  // Update agent stats utilization
  const agent = loadAgent(root, agentId);
  if (agent) {
    agent.stats = agent.stats || {};
    agent.stats.utilization_units = (agent.stats.utilization_units || 0) + units;
    saveAgent(root, agent);
  }

  return alloc;
}

/**
 * releaseAgent(root, allocationId) → void
 */
export function releaseAgent(root, allocationId) {
  const alloc = readAlloc(root, allocationId);
  if (!alloc) throw new Error(`Allocation not found: ${allocationId}`);

  alloc.status = "released";
  alloc.released_at = new Date().toISOString();
  writeAlloc(root, alloc);

  // Update index
  const idx = readAllocIndex(root);
  const entry = idx.allocations.find(a => a.allocation_id === allocationId);
  if (entry) entry.status = "released";
  writeAllocIndex(root, idx);

  // Restore capacity in agent stats
  const agent = loadAgent(root, alloc.agent_id);
  if (agent) {
    agent.stats = agent.stats || {};
    agent.stats.utilization_units = Math.max(
      0,
      (agent.stats.utilization_units || 0) - (alloc.allocation_units || 0)
    );
    saveAgent(root, agent);
  }
}

/**
 * listProjectAllocations(root, projectId) → active allocations for project
 */
export function listProjectAllocations(root, projectId) {
  const idx = readAllocIndex(root);
  return idx.allocations
    .filter(a => a.project_id === projectId && a.status === "active")
    .map(a => readAlloc(root, a.allocation_id))
    .filter(Boolean);
}

/**
 * listAgentAllocations(root, agentId) → all allocations for agent
 */
export function listAgentAllocations(root, agentId) {
  const idx = readAllocIndex(root);
  return idx.allocations
    .filter(a => a.agent_id === agentId)
    .map(a => readAlloc(root, a.allocation_id))
    .filter(Boolean);
}
