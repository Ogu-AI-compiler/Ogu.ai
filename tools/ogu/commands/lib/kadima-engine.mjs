/**
 * Kadima Engine — unified orchestration: agents, worktrees, budget,
 * OrgSpec roles, disk-persisted allocations, standup generation.
 *
 * Exports:
 *   createKadimaEngine()                — in-memory engine (backwards compat)
 *   initKadimaFromOrgSpec(root)         — load OrgSpec and init engine with all roles
 *   allocatePlan(tasks, options)         — assign roles to Plan.json tasks
 *   generateStandup(root, options)       — generate standup report
 *   loadAllocations(root)               — load allocations from disk
 *   saveAllocations(root, allocations)  — persist allocations to disk
 *   getSystemStatus(root)               — comprehensive system status
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { loadOrgSpec, loadAgentState, matchRole } from './agent-registry.mjs';
import { loadAllEvents } from './audit-emitter.mjs';
import { loadBudget } from './budget-tracker.mjs';
import { createWorktree, listAgentWorktrees } from './worktree-manager.mjs';
import { routeModel } from './model-router.mjs';

const ALLOCATIONS_PATH = '.ogu/state/allocations.json';
const STATE_DIR = '.ogu/state';

// ── Disk persistence ──

/**
 * Load allocations from disk. Returns [] if file missing.
 * @param {string} [root]
 */
export function loadAllocations(root) {
  root = root || repoRoot();
  const filePath = join(root, ALLOCATIONS_PATH);
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

/**
 * Persist allocations to disk. Creates .ogu/state/ if needed.
 * @param {string} [root]
 * @param {Array<object>} allocations
 */
export function saveAllocations(root, allocations) {
  root = root || repoRoot();
  const dir = join(root, STATE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, ALLOCATIONS_PATH), JSON.stringify(allocations, null, 2), 'utf8');
}

// ── OrgSpec integration ──

/**
 * Initialize a Kadima engine from OrgSpec.
 * Registers every enabled role, restores active allocations from disk.
 * @param {string} [root]
 * @returns {{ engine: object, spec: object, roles: string[] }}
 */
export function initKadimaFromOrgSpec(root) {
  root = root || repoRoot();
  const spec = loadOrgSpec(root);
  if (!spec) throw new Error('OGU2001: OrgSpec.json not found — run ogu org seed first');

  const engine = createKadimaEngine();
  const registeredRoles = [];

  for (const role of spec.roles) {
    if (role.enabled === false) continue;
    engine.registerAgent(role.roleId, {
      capabilities: role.capabilities || [],
      maxConcurrent: role.maxConcurrent || 1,
    });
    registeredRoles.push(role.roleId);
  }

  // Restore persisted active allocations
  for (const alloc of loadAllocations(root)) {
    if (alloc.status === 'active') {
      engine.assignTask({
        taskId: alloc.taskId,
        requiredCapabilities: alloc.requiredCapabilities || [],
        priority: alloc.priority || 'normal',
      });
    }
  }

  return { engine, spec, roles: registeredRoles };
}

// ── Plan allocation ──

/** Phase-to-capability mapping for automatic role matching. */
const PHASE_CAPABILITY_MAP = {
  idea: ['ideation', 'product'],
  feature: ['product', 'writing'],
  architect: ['architecture', 'code-review'],
  design: ['design', 'ui'],
  preflight: ['validation', 'testing'],
  lock: ['validation'],
  build: ['code-gen', 'implementation'],
  verify: ['testing', 'qa'],
  enforce: ['validation', 'contracts'],
  preview: ['deployment', 'testing'],
  done: ['validation', 'compilation'],
  observe: ['monitoring', 'analytics'],
  pipeline: ['orchestration'],
  governance: ['governance', 'policy'],
};

/**
 * Allocate Plan.json tasks to roles via OrgSpec matching.
 * Persists allocations to disk and optionally creates worktrees.
 *
 * @param {Array<object>} tasks — { id, phase, capabilities?, riskTier?, priority? }
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {boolean} [options.persist=true]
 * @param {string} [options.featureSlug]
 * @param {boolean} [options.worktree=false]
 * @returns {Array<{ taskId, roleId, model, priority, phase, worktree? }>}
 */
export function allocatePlan(tasks, options = {}) {
  const root = options.root || repoRoot();
  const persist = options.persist !== false;
  const featureSlug = options.featureSlug || 'unknown';

  const spec = loadOrgSpec(root);
  if (!spec) throw new Error('OGU2001: OrgSpec.json not found — cannot allocate tasks');

  const existing = loadAllocations(root);
  const existingIds = new Set(existing.map(a => a.taskId));
  const results = [];

  for (const task of tasks) {
    const taskId = task.id || task.taskId;
    if (!taskId) continue;

    // Skip already-allocated
    if (existingIds.has(taskId)) {
      const prev = existing.find(a => a.taskId === taskId);
      if (prev) { results.push(prev); continue; }
    }

    const phase = task.phase || 'build';
    const priority = task.priority || 'normal';
    const criteria = { phase };
    if (task.riskTier) criteria.riskTier = task.riskTier;

    const taskCaps = task.capabilities || PHASE_CAPABILITY_MAP[phase] || [];
    if (taskCaps.length > 0) criteria.capability = taskCaps[0];

    const matched = matchRole(criteria);
    const roleId = matched?.roleId || '_default';

    // Use model-router for intelligent model selection
    let model = matched?.model || spec.defaults?.model || 'claude-sonnet-4-20250514';
    try {
      const routing = routeModel({ root, roleId, phase, taskId, failureCount: 0 });
      if (routing?.model) model = routing.model;
    } catch { /* fall back to matched/default model */ }

    const allocation = {
      taskId, roleId, model, priority, phase,
      requiredCapabilities: taskCaps,
      assignedAt: new Date().toISOString(),
      status: 'active',
    };

    // Optionally create worktree for isolated execution
    if (options.worktree) {
      try {
        const wt = createWorktree(root, { featureSlug, taskId, roleId, dryRun: false });
        allocation.worktree = { path: wt.path, branch: wt.branch, name: wt.name };
      } catch (err) { allocation.worktreeError = err.message; }
    }

    results.push(allocation);
  }

  // Merge with existing (replace duplicates by taskId)
  const merged = [...existing.filter(a => !results.some(r => r.taskId === a.taskId)), ...results];
  if (persist) saveAllocations(root, merged);

  return results;
}

// ── Standup generation ──

/**
 * Generate standup report from allocations, audit events, and budget.
 *
 * @param {string} [root]
 * @param {object} [options]
 * @param {number} [options.eventLimit=50]
 * @param {boolean} [options.includeWorktrees=true]
 * @returns {{ date, allocations, agents, budget, recentEvents, worktrees?, summary }}
 */
export function generateStandup(root, options = {}) {
  root = root || repoRoot();
  const eventLimit = options.eventLimit || 50;
  const includeWorktrees = options.includeWorktrees !== false;
  const today = new Date().toISOString().split('T')[0];

  // Allocations
  const allocs = loadAllocations(root);
  const active = allocs.filter(a => a.status === 'active');
  const completed = allocs.filter(a => a.status === 'completed');
  const failed = allocs.filter(a => a.status === 'failed');

  // Agent states from OrgSpec
  const spec = loadOrgSpec(root);
  const agentSummaries = {};
  if (spec?.roles) {
    for (const role of spec.roles) {
      if (role.enabled === false) continue;
      try {
        const st = loadAgentState(role.roleId, root);
        agentSummaries[role.roleId] = {
          tasksCompleted: st.tasksCompleted || 0,
          tasksFailed: st.tasksFailed || 0,
          tokensUsedToday: st.tokensUsedToday || 0,
          costToday: st.costToday || 0,
          lastActiveAt: st.lastActiveAt || null,
          currentTask: st.currentTask || null,
        };
      } catch { agentSummaries[role.roleId] = { error: 'state_unavailable' }; }
    }
  }

  // Budget
  let budgetSummary = { error: 'unavailable' };
  try {
    const b = loadBudget();
    budgetSummary = {
      daily: {
        spent: b.daily?.costUsed || 0, limit: b.daily?.limit || 50,
        tokensUsed: b.daily?.tokensUsed || 0,
        remaining: (b.daily?.limit || 50) - (b.daily?.costUsed || 0),
      },
      monthly: {
        spent: b.monthly?.costUsed || 0, limit: b.monthly?.limit || 1000,
        tokensUsed: b.monthly?.tokensUsed || 0,
        remaining: (b.monthly?.limit || 1000) - (b.monthly?.costUsed || 0),
      },
    };
  } catch { /* not fatal */ }

  // Recent audit events (today only)
  let recentEvents = [];
  try {
    const all = loadAllEvents();
    recentEvents = all
      .filter(e => e.timestamp?.startsWith(today))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, eventLimit)
      .map(e => ({ id: e.id, type: e.type, severity: e.severity, timestamp: e.timestamp, feature: e.feature || null, source: e.source }));
  } catch { /* not fatal */ }

  // Worktrees
  let worktrees = [];
  if (includeWorktrees) {
    try {
      worktrees = listAgentWorktrees(root).map(w => ({ path: w.path, branch: w.branch, head: w.head?.slice(0, 8) }));
    } catch { /* not fatal */ }
  }

  // Summary text
  const lines = [
    `Standup Report — ${today}`, '',
    `Allocations: ${active.length} active, ${completed.length} completed, ${failed.length} failed`,
    `Agents: ${Object.keys(agentSummaries).length} registered`,
  ];
  if (budgetSummary.daily) {
    lines.push(`Budget: $${budgetSummary.daily.spent.toFixed(2)} / $${budgetSummary.daily.limit} daily ($${budgetSummary.daily.remaining.toFixed(2)} remaining)`);
  }
  lines.push(`Events today: ${recentEvents.length}`);
  if (worktrees.length > 0) lines.push(`Active worktrees: ${worktrees.length}`);

  return {
    date: today,
    allocations: { total: allocs.length, active: active.length, completed: completed.length, failed: failed.length, items: allocs },
    agents: agentSummaries,
    budget: budgetSummary,
    recentEvents,
    worktrees: includeWorktrees ? worktrees : undefined,
    summary: lines.join('\n'),
  };
}

// ── System status ──

/**
 * Comprehensive system status — the Kadima dashboard view.
 * @param {string} [root]
 * @returns {{ healthy, issues, orgSpec, agents, allocations, budget, events, worktrees }}
 */
export function getSystemStatus(root) {
  root = root || repoRoot();
  const issues = [];

  // OrgSpec
  let orgSpecStatus = { loaded: false, roleCount: 0, teamCount: 0 };
  let spec = null;
  try {
    spec = loadOrgSpec(root);
    if (spec) {
      orgSpecStatus = {
        loaded: true,
        roleCount: spec.roles?.length || 0,
        teamCount: spec.teams?.length || 0,
        enabledRoles: spec.roles?.filter(r => r.enabled !== false).length || 0,
      };
    }
  } catch (err) {
    orgSpecStatus = { loaded: false, error: err.message };
    issues.push('OrgSpec failed to load');
  }

  // Allocations + staleness check
  const allocs = loadAllocations(root);
  const active = allocs.filter(a => a.status === 'active');
  const stale = active.filter(a => a.assignedAt && (Date.now() - new Date(a.assignedAt).getTime()) > 86400000);
  if (stale.length > 0) issues.push(`${stale.length} stale allocation(s) older than 24h`);

  // Agent states
  const agentStates = {};
  if (spec?.roles) {
    for (const role of spec.roles) {
      if (role.enabled === false) continue;
      try {
        const st = loadAgentState(role.roleId, root);
        agentStates[role.roleId] = {
          tasksCompleted: st.tasksCompleted || 0, tasksFailed: st.tasksFailed || 0,
          tokensUsed: st.tokensUsed || 0, tokensUsedToday: st.tokensUsedToday || 0,
          costUsed: st.costUsed || 0, costToday: st.costToday || 0,
          escalations: st.escalations || 0,
          lastActiveAt: st.lastActiveAt || null, currentTask: st.currentTask || null,
        };
      } catch { agentStates[role.roleId] = { error: 'state_unavailable' }; }
    }
  }

  // Budget
  let budgetStatus = { available: false };
  try {
    const b = loadBudget();
    const dailyPct = b.daily?.limit ? ((b.daily.costUsed || 0) / b.daily.limit) * 100 : 0;
    const monthlyPct = b.monthly?.limit ? ((b.monthly.costUsed || 0) / b.monthly.limit) * 100 : 0;
    budgetStatus = {
      available: true,
      daily: { spent: b.daily?.costUsed || 0, limit: b.daily?.limit || 50, usagePercent: Math.round(dailyPct) },
      monthly: { spent: b.monthly?.costUsed || 0, limit: b.monthly?.limit || 1000, usagePercent: Math.round(monthlyPct) },
    };
    if (dailyPct > 90) issues.push('Daily budget usage above 90%');
    if (monthlyPct > 90) issues.push('Monthly budget usage above 90%');
  } catch { /* budget unavailable */ }

  // Recent events (last 24h)
  let eventSummary = { total: 0, errors: 0, warnings: 0 };
  try {
    const cutoff = Date.now() - 86400000;
    const recent = loadAllEvents().filter(e => e.timestamp && new Date(e.timestamp).getTime() > cutoff);
    eventSummary = {
      total: recent.length,
      errors: recent.filter(e => e.severity === 'error' || e.severity === 'critical').length,
      warnings: recent.filter(e => e.severity === 'warn').length,
    };
    if (eventSummary.errors > 0) issues.push(`${eventSummary.errors} error/critical event(s) in last 24h`);
  } catch { /* audit unavailable */ }

  // Worktrees
  let worktreeStatus = { count: 0 };
  try {
    const wts = listAgentWorktrees(root);
    worktreeStatus = { count: wts.length, branches: wts.map(w => w.branch).filter(Boolean) };
  } catch { /* unavailable */ }

  return {
    healthy: issues.length === 0, issues,
    timestamp: new Date().toISOString(),
    orgSpec: orgSpecStatus,
    agents: agentStates,
    allocations: {
      total: allocs.length, active: active.length,
      completed: allocs.filter(a => a.status === 'completed').length,
      failed: allocs.filter(a => a.status === 'failed').length,
      stale: stale.length,
    },
    budget: budgetStatus,
    events: eventSummary,
    worktrees: worktreeStatus,
  };
}

// ── In-memory engine (backwards compatible) ──

/**
 * Create an in-memory Kadima engine.
 * Original API kept for backwards compatibility.
 * For production use prefer initKadimaFromOrgSpec().
 *
 * @returns {object} Engine with registerAgent/assignTask/completeTask/getAgentStatus/getAllocations
 */
export function createKadimaEngine() {
  const agents = new Map();
  const allocations = new Map();

  function registerAgent(agentId, { capabilities = [], maxConcurrent = 1 }) {
    agents.set(agentId, {
      agentId,
      capabilities: new Set(capabilities),
      maxConcurrent,
      activeTasks: new Set(),
    });
  }

  function findAgent(requiredCapabilities) {
    for (const [id, agent] of agents) {
      const hasCapabilities = requiredCapabilities.every(c => agent.capabilities.has(c));
      const hasCapacity = agent.activeTasks.size < agent.maxConcurrent;
      if (hasCapabilities && hasCapacity) return id;
    }
    return null;
  }

  function assignTask({ taskId, requiredCapabilities = [], priority = 'normal' }) {
    const agentId = findAgent(requiredCapabilities);
    if (!agentId) return null;

    const agent = agents.get(agentId);
    agent.activeTasks.add(taskId);

    const allocation = { agentId, taskId, priority, assignedAt: new Date().toISOString() };
    allocations.set(taskId, allocation);
    return allocation;
  }

  function completeTask(taskId, { result } = {}) {
    const allocation = allocations.get(taskId);
    if (!allocation) return null;
    const agent = agents.get(allocation.agentId);
    if (agent) agent.activeTasks.delete(taskId);
    allocations.delete(taskId);
    return { ...allocation, result, completedAt: new Date().toISOString() };
  }

  function getAgentStatus(agentId) {
    const agent = agents.get(agentId);
    if (!agent) return null;
    return {
      agentId, activeTasks: agent.activeTasks.size,
      maxConcurrent: agent.maxConcurrent,
      capabilities: Array.from(agent.capabilities),
    };
  }

  function getAllocations() {
    return Array.from(allocations.values());
  }

  return { registerAgent, assignTask, completeTask, getAgentStatus, getAllocations };
}
