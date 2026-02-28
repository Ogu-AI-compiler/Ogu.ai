import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Studio Data Provider — aggregated data endpoints for Studio UI panels.
 *
 * Reads from .ogu/ state files and provides structured data for:
 * org, budget, audit, governance, agents, and dashboard.
 */

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Get organization data from OrgSpec.
 */
export function getOrgData({ root } = {}) {
  root = root || repoRoot();
  const org = readJson(join(root, '.ogu/OrgSpec.json'));
  if (!org) return { company: 'Unknown', roles: [], providers: [] };

  return {
    company: org.company || 'Unknown',
    roles: (org.roles || []).map(r => ({
      id: r.id,
      name: r.name,
      capabilities: r.capabilities || [],
    })),
    providers: org.providers || [],
    budget: org.budget || {},
    governance: org.governance || {},
  };
}

/**
 * Get budget summary.
 */
export function getBudgetData({ root } = {}) {
  root = root || repoRoot();
  const state = readJson(join(root, '.ogu/budget/budget-state.json'));
  if (!state) {
    return { daily: { spent: 0, limit: 0 }, monthly: { spent: 0, limit: 0 } };
  }
  return {
    daily: state.daily || { spent: 0, limit: 0 },
    monthly: state.monthly || { spent: 0, limit: 0 },
  };
}

/**
 * Get recent audit events.
 */
export function getAuditData({ root, limit } = {}) {
  root = root || repoRoot();
  limit = limit || 50;

  const logPath = join(root, '.ogu/audit/current.jsonl');
  if (!existsSync(logPath)) return { events: [], total: 0 };

  const content = readFileSync(logPath, 'utf8').trim();
  if (!content) return { events: [], total: 0 };

  const lines = content.split('\n').filter(Boolean);
  const events = [];

  for (const line of lines.slice(-limit)) {
    try { events.push(JSON.parse(line)); } catch { /* skip */ }
  }

  return { events, total: lines.length };
}

/**
 * Get governance state — pending approvals and policies.
 */
export function getGovernanceData({ root } = {}) {
  root = root || repoRoot();

  // Pending approvals
  const approvalsDir = join(root, '.ogu/approvals');
  let pendingApprovals = [];
  if (existsSync(approvalsDir)) {
    const files = readdirSync(approvalsDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const data = readJson(join(approvalsDir, f));
        if (data && data.status === 'pending') {
          pendingApprovals.push(data);
        }
      } catch { /* skip */ }
    }
  }

  // Policies
  const policiesPath = join(root, '.ogu/policies/rules.json');
  const policies = readJson(policiesPath);

  return {
    pendingApprovals,
    policies: Array.isArray(policies) ? policies : (policies?.rules || []),
  };
}

/**
 * Get agent session data.
 */
export function getAgentData({ root } = {}) {
  root = root || repoRoot();

  const sessionsDir = join(root, '.ogu/agents/sessions');
  let sessions = [];
  if (existsSync(sessionsDir)) {
    const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const data = readJson(join(sessionsDir, f));
        if (data) sessions.push(data);
      } catch { /* skip */ }
    }
  }

  // Roles from OrgSpec
  const org = readJson(join(root, '.ogu/OrgSpec.json'));
  const roles = (org?.roles || []).map(r => ({
    id: r.id,
    name: r.name,
    capabilities: r.capabilities || [],
  }));

  return { sessions, roles };
}

/**
 * Get complete dashboard snapshot — all data in one call.
 */
export function getDashboardSnapshot({ root } = {}) {
  root = root || repoRoot();
  return {
    org: getOrgData({ root }),
    budget: getBudgetData({ root }),
    audit: getAuditData({ root, limit: 20 }),
    governance: getGovernanceData({ root }),
    agents: getAgentData({ root }),
    timestamp: new Date().toISOString(),
  };
}
