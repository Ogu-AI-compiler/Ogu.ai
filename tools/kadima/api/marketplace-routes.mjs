/**
 * Marketplace routes — agent marketplace, hiring, allocations, patterns.
 * Part of the Kadima API.
 *
 * Handles:
 *   GET  /api/marketplace/agents           — list agents with price
 *   GET  /api/marketplace/agents/:id       — single agent with price + allocations
 *   POST /api/marketplace/agents/generate  — generate + save one agent
 *   POST /api/marketplace/agents/populate  — generate 30 agents
 *   POST /api/marketplace/hire             — hire agent into project
 *   DELETE /api/marketplace/allocations/:id — release allocation
 *   GET  /api/marketplace/allocations      — list active allocations
 *   GET  /api/marketplace/patterns         — list all patterns
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = resolve(__dirname, '..', '..', 'ogu', 'commands', 'lib');

/** Marketplace is global — always points to the main Ogu repo, never to a project sub-directory */
function getMarketplaceRoot() {
  return process.env.OGU_MARKETPLACE_ROOT || process.env.OGU_ROOT || process.cwd();
}

// Lazy-loaded lib modules
let _generator = null;
let _store = null;
let _pricing = null;
let _allocator = null;
let _patterns = null;

async function generator() {
  if (!_generator) _generator = await import(`${LIB_DIR}/agent-generator.mjs`);
  return _generator;
}
async function store() {
  if (!_store) _store = await import(`${LIB_DIR}/agent-store.mjs`);
  return _store;
}
async function pricing() {
  if (!_pricing) _pricing = await import(`${LIB_DIR}/pricing-engine.mjs`);
  return _pricing;
}
async function allocator() {
  if (!_allocator) _allocator = await import(`${LIB_DIR}/marketplace-allocator.mjs`);
  return _allocator;
}
async function patterns() {
  if (!_patterns) _patterns = await import(`${LIB_DIR}/pattern-store.mjs`);
  return _patterns;
}

const ALL_ROLES       = ['PM', 'Architect', 'Engineer', 'QA', 'DevOps', 'Security', 'Doc'];
const ALL_SPECIALTIES = ['frontend', 'backend', 'mobile', 'data', 'platform', 'security-audit', 'ai-ml', 'product', 'docs-api', 'distributed'];

/**
 * Handle marketplace routes. Returns true if the request was handled.
 */
export async function handleMarketplaceRoutes(url, method, readBody, res, root, broadcaster, json) {
  const path = url.pathname;

  // GET /api/marketplace/agents
  if (method === 'GET' && path === '/api/marketplace/agents') {
    const mroot = getMarketplaceRoot();
    const { listAgents, loadAgent } = await store();
    const { computeFinalPrice } = await pricing();

    const filters = {};
    const role      = url.searchParams.get('role');
    const tier      = url.searchParams.get('tier');
    const available = url.searchParams.get('available');
    if (role)      filters.role      = role;
    if (tier)      filters.tier      = Number(tier);
    if (available) filters.available = available === 'true';

    const entries = listAgents(mroot, filters);
    const agents = entries.map((e) => {
      const agent = loadAgent(mroot, e.agent_id);
      if (!agent) return null;
      return { ...agent, price: computeFinalPrice(mroot, agent) };
    }).filter(Boolean);

    json(res, 200, { agents });
    return true;
  }

  // GET /api/marketplace/agents/:id  (must come before /agents/generate check below)
  const agentIdMatch = path.match(/^\/api\/marketplace\/agents\/([^/]+)$/);
  if (method === 'GET' && agentIdMatch && agentIdMatch[1] !== 'generate' && agentIdMatch[1] !== 'populate') {
    const mroot   = getMarketplaceRoot();
    const agentId = agentIdMatch[1];
    const { loadAgent } = await store();
    const { computeFinalPrice } = await pricing();
    const { listAgentAllocations } = await allocator();

    const agent = loadAgent(mroot, agentId);
    if (!agent) { json(res, 404, { error: 'Agent not found' }); return true; }

    const allocations = listAgentAllocations(mroot, agentId);
    const price = computeFinalPrice(mroot, agent);
    json(res, 200, { ...agent, price, allocations });
    return true;
  }

  // POST /api/marketplace/agents/generate
  if (method === 'POST' && path === '/api/marketplace/agents/generate') {
    const mroot = getMarketplaceRoot();
    const body = await readBody();
    const { role, specialty, tier, seed } = body;

    if (!role || !specialty || !tier) {
      json(res, 400, { error: 'role, specialty, and tier are required' });
      return true;
    }

    const { generateAgent } = await generator();
    const { saveAgent }     = await store();
    const { computeBasePrice } = await pricing();

    const profile = generateAgent({ role, specialty, tier: Number(tier), seed });
    const saved   = saveAgent(mroot, profile);
    const base    = computeBasePrice(mroot, Number(tier));
    json(res, 201, { agent: { ...saved, base_price: base } });
    return true;
  }

  // POST /api/marketplace/agents/populate
  if (method === 'POST' && path === '/api/marketplace/agents/populate') {
    const mroot = getMarketplaceRoot();
    const body = await readBody().catch(() => ({}));
    const count = body.count || 30;

    const { generateAgent } = await generator();
    const { saveAgent }     = await store();
    const tiers = [1, 2, 3, 4];
    const created = [];

    for (let i = 0; i < count; i++) {
      const role      = ALL_ROLES[i % ALL_ROLES.length];
      const specialty = ALL_SPECIALTIES[i % ALL_SPECIALTIES.length];
      const tier      = tiers[i % tiers.length];
      const profile   = generateAgent({ role, specialty, tier, seed: i * 7919 + 42 });
      const saved     = saveAgent(mroot, profile);
      created.push(saved.agent_id);
    }

    json(res, 200, { created: created.length, ids: created });
    return true;
  }

  // POST /api/marketplace/hire
  if (method === 'POST' && path === '/api/marketplace/hire') {
    const mroot = getMarketplaceRoot();
    const body = await readBody();
    const { projectId, agentId, roleSlot, allocationUnits, priorityLevel } = body;

    if (!projectId || !agentId || !allocationUnits) {
      json(res, 400, { error: 'projectId, agentId, and allocationUnits are required' });
      return true;
    }

    const { hireAgent } = await allocator();
    try {
      const alloc = hireAgent(mroot, { projectId, agentId, roleSlot: roleSlot || 'default', allocationUnits, priorityLevel });
      json(res, 201, { allocation: alloc });
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return true;
  }

  // DELETE /api/marketplace/allocations/:id
  const allocIdMatch = path.match(/^\/api\/marketplace\/allocations\/([^/]+)$/);
  if (method === 'DELETE' && allocIdMatch) {
    const mroot        = getMarketplaceRoot();
    const allocationId = allocIdMatch[1];
    const { releaseAgent } = await allocator();
    try {
      releaseAgent(mroot, allocationId);
      json(res, 200, { ok: true, released: allocationId });
    } catch (e) {
      json(res, 404, { error: e.message });
    }
    return true;
  }

  // GET /api/marketplace/allocations
  if (method === 'GET' && path === '/api/marketplace/allocations') {
    const mroot     = getMarketplaceRoot();
    const projectId = url.searchParams.get('projectId');
    const agentId   = url.searchParams.get('agentId');
    const { listProjectAllocations, listAgentAllocations } = await allocator();

    if (agentId)   { json(res, 200, { allocations: listAgentAllocations(mroot, agentId) });   return true; }
    if (projectId) { json(res, 200, { allocations: listProjectAllocations(mroot, projectId) }); return true; }
    json(res, 200, { allocations: [] });
    return true;
  }

  // GET /api/marketplace/patterns
  if (method === 'GET' && path === '/api/marketplace/patterns') {
    const mroot = getMarketplaceRoot();
    const { listPatterns } = await patterns();
    json(res, 200, { patterns: listPatterns(mroot) });
    return true;
  }

  return false;
}
