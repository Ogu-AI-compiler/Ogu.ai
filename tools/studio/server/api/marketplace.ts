/**
 * marketplace.ts — Slice 377
 * Hono router for marketplace agent system.
 * Mount: /api/marketplace
 */

import { Hono } from "hono";
import { join } from "path";
import { existsSync } from "fs";

function getRoot() {
  return process.env.OGU_ROOT || process.cwd();
}

/** Marketplace is global — always points to the main Ogu repo, never to a project sub-directory */
function getMarketplaceRoot() {
  return process.env.OGU_MARKETPLACE_ROOT || process.env.OGU_ROOT || process.cwd();
}

// Lazy-load ESM libs at runtime
let _generator: any = null;
let _store: any = null;
let _pricing: any = null;
let _allocator: any = null;
let _patterns: any = null;

async function generator() {
  if (!_generator) _generator = await import("../../../ogu/commands/lib/agent-generator.mjs");
  return _generator;
}
async function store() {
  if (!_store) _store = await import("../../../ogu/commands/lib/agent-store.mjs");
  return _store;
}
async function pricing() {
  if (!_pricing) _pricing = await import("../../../ogu/commands/lib/pricing-engine.mjs");
  return _pricing;
}
async function allocator() {
  if (!_allocator) _allocator = await import("../../../ogu/commands/lib/marketplace-allocator.mjs");
  return _allocator;
}
async function patterns() {
  if (!_patterns) _patterns = await import("../../../ogu/commands/lib/pattern-store.mjs");
  return _patterns;
}

const ALL_ROLES      = ["PM","Architect","Engineer","QA","DevOps","Security","Doc"];
const ALL_SPECIALTIES = ["frontend","backend","mobile","data","platform","security-audit","ai-ml","product","docs-api","distributed"];

export function createMarketplaceApi() {
  const api = new Hono();

  /** GET /agents — list agents with computed final price */
  api.get("/agents", async (c) => {
    const root = getMarketplaceRoot();
    const { listAgents, loadAgent } = await store();
    const { computeFinalPrice } = await pricing();

    const filters: any = {};
    const role      = c.req.query("role");
    const tier      = c.req.query("tier");
    const available = c.req.query("available");
    if (role)      filters.role      = role;
    if (tier)      filters.tier      = Number(tier);
    if (available) filters.available = available === "true";

    const entries = listAgents(root, filters);
    const agents = entries.map((e: any) => {
      const agent = loadAgent(root, e.agent_id);
      if (!agent) return null;
      return { ...agent, price: computeFinalPrice(root, agent) };
    }).filter(Boolean);

    return c.json({ agents });
  });

  /** GET /agents/:id — single agent profile with price + allocations */
  api.get("/agents/:id", async (c) => {
    const root = getMarketplaceRoot();
    const agentId = c.req.param("id");
    const { loadAgent } = await store();
    const { computeFinalPrice } = await pricing();
    const { listAgentAllocations } = await allocator();

    const agent = loadAgent(root, agentId);
    if (!agent) return c.json({ error: "Agent not found" }, 404);

    const allocations = listAgentAllocations(root, agentId);
    const price = computeFinalPrice(root, agent);
    return c.json({ ...agent, price, allocations });
  });

  /** POST /agents/generate — generate + save one agent */
  api.post("/agents/generate", async (c) => {
    const root = getMarketplaceRoot();
    const body = await c.req.json() as { role?: string; specialty?: string; tier?: number; seed?: number };
    const { role, specialty, tier, seed } = body;

    if (!role || !specialty || !tier) {
      return c.json({ error: "role, specialty, and tier are required" }, 400);
    }

    const { generateAgent } = await generator();
    const { saveAgent } = await store();
    const { computeBasePrice } = await pricing();

    const profile = generateAgent({ role, specialty, tier: Number(tier), seed });
    const saved   = saveAgent(root, profile);
    const base    = computeBasePrice(root, Number(tier));
    return c.json({ agent: { ...saved, base_price: base } }, 201);
  });

  /** POST /agents/populate — generate 30 agents with varied profiles */
  api.post("/agents/populate", async (c) => {
    const root = getMarketplaceRoot();
    const body = await c.req.json().catch(() => ({})) as { count?: number };
    const count = body.count || 30;

    const { generateAgent } = await generator();
    const { saveAgent } = await store();
    const tiers = [1, 2, 3, 4];
    const created: string[] = [];

    for (let i = 0; i < count; i++) {
      const role      = ALL_ROLES[i % ALL_ROLES.length];
      const specialty = ALL_SPECIALTIES[i % ALL_SPECIALTIES.length];
      const tier      = tiers[i % tiers.length];
      const profile   = generateAgent({ role, specialty, tier, seed: i * 7919 + 42 });
      const saved     = saveAgent(root, profile);
      created.push(saved.agent_id);
    }

    return c.json({ created: created.length, ids: created });
  });

  /** POST /hire — hire agent into project */
  api.post("/hire", async (c) => {
    const root = getMarketplaceRoot();
    const body = await c.req.json() as { projectId?: string; agentId?: string; roleSlot?: string; allocationUnits?: number; priorityLevel?: number };
    const { projectId, agentId, roleSlot, allocationUnits, priorityLevel } = body;

    if (!projectId || !agentId || !allocationUnits) {
      return c.json({ error: "projectId, agentId, and allocationUnits are required" }, 400);
    }

    const { hireAgent } = await allocator();
    try {
      const alloc = hireAgent(root, { projectId, agentId, roleSlot: roleSlot || "default", allocationUnits, priorityLevel });
      return c.json({ allocation: alloc }, 201);
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  /** DELETE /allocations/:id — release allocation */
  api.delete("/allocations/:id", async (c) => {
    const root = getMarketplaceRoot();
    const allocationId = c.req.param("id");
    const { releaseAgent } = await allocator();
    try {
      releaseAgent(root, allocationId);
      return c.json({ ok: true, released: allocationId });
    } catch (e: any) {
      return c.json({ error: e.message }, 404);
    }
  });

  /** GET /allocations — list active allocations for active project */
  api.get("/allocations", async (c) => {
    const root = getMarketplaceRoot();
    const projectId = c.req.query("projectId");
    const agentId   = c.req.query("agentId");
    const { listProjectAllocations, listAgentAllocations } = await allocator();

    if (agentId) {
      return c.json({ allocations: listAgentAllocations(root, agentId) });
    }
    if (projectId) {
      return c.json({ allocations: listProjectAllocations(root, projectId) });
    }
    return c.json({ allocations: [] });
  });

  /** GET /patterns — list all patterns (debug/admin) */
  api.get("/patterns", async (c) => {
    const root = getMarketplaceRoot();
    const { listPatterns } = await patterns();
    return c.json({ patterns: listPatterns(root) });
  });

  return api;
}
