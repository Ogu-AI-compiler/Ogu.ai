import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { evaluatePolicy } from './policy-engine.mjs';
import { emitAudit } from './audit-emitter.mjs';
import { loadOrgSpec } from './agent-registry.mjs';

/**
 * Governance Evaluation Engine — wraps the policy engine with business logic.
 *
 * Exports:
 *   checkGovernance(root, opts)       — Full governance check
 *   evaluateTrigger(root, trigger)    — Evaluate a single governance trigger
 *   resolveApproval(root, opts)       — Check if approvals satisfy requirements
 *   describeViolation(violation)      — Human-readable violation description
 *   loadGovernancePolicies(root)      — Load governance policies from disk
 */

const RISK_ORDER = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Full governance check combining policy evaluation, scope violation detection,
 * budget check, and risk tier assessment.
 *
 * @param {string} root
 * @param {object} opts - { featureSlug, taskName, roleId, riskTier, touches, phase }
 * @returns {{ allowed, decision, violations, approvals_needed, reason }}
 */
export function checkGovernance(root, { featureSlug, taskName, roleId, riskTier, touches, phase }) {
  root = root || repoRoot();
  const violations = [];
  const approvalsNeeded = [];

  const policies = loadGovernancePolicies(root).filter(p => p.enabled);
  const orgSpec = loadOrgSpec(root);
  const role = orgSpec?.roles?.find(r => r.roleId === roleId) || null;

  // Evaluate each governance policy trigger
  for (const policy of policies) {
    const trigger = buildTriggerContext(policy, { roleId, riskTier, touches, role });
    const result = evaluateTrigger(root, trigger);
    if (result.triggered) {
      violations.push({
        policyId: policy.id, policyName: policy.name,
        trigger: policy.trigger, action: policy.action, detail: result.detail,
      });
      if (policy.action === 'require_approval') {
        for (const a of (policy.approvers || [])) {
          if (!approvalsNeeded.includes(a)) approvalsNeeded.push(a);
        }
      }
    }
  }

  // Evaluate via policy engine (AST/legacy rules)
  const policyResult = evaluatePolicy({
    _root: root, featureSlug, taskName, roleId, riskTier,
    touches: touches || [], phase,
    scopeViolation: violations.some(v => v.trigger === 'scope_violation'),
    budgetExceeded: violations.some(v => v.trigger === 'budget_exceeded'),
  });

  // Determine final decision
  const hasDeny = violations.some(v => v.action === 'deny') || policyResult.decision === 'DENY';
  const hasApproval = violations.some(v => v.action === 'require_approval') || policyResult.decision === 'REQUIRES_APPROVAL';

  let decision, reason;
  if (hasDeny) {
    decision = 'DENY';
    const dv = violations.find(v => v.action === 'deny');
    reason = dv ? `Denied by policy "${dv.policyName}": ${dv.detail}` : policyResult.reason;
  } else if (hasApproval) {
    decision = 'REQUIRES_APPROVAL';
    reason = `Approval needed from: ${approvalsNeeded.join(', ')}`;
  } else {
    decision = 'ALLOW';
    reason = violations.length === 0 ? 'No governance violations'
      : `${violations.length} notification(s) raised, no blocking violations`;
  }

  emitAudit('governance.check', {
    featureSlug, taskName, roleId, riskTier, decision,
    violations: violations.length, approvalsNeeded,
  }, {
    feature: featureSlug, severity: decision === 'DENY' ? 'warn' : 'info',
    source: 'governance-engine', tags: ['governance', decision.toLowerCase()],
  });

  return { allowed: decision === 'ALLOW', decision, violations, approvals_needed: approvalsNeeded, reason };
}

// ── Trigger evaluation ──

/**
 * Evaluate a governance trigger.
 * Types: scope_violation, path_match, budget_exceeded, risk_tier, cross_boundary
 */
export function evaluateTrigger(root, trigger) {
  root = root || repoRoot();
  switch (trigger.type) {
    case 'scope_violation': return evalScope(trigger);
    case 'path_match': return evalPathMatch(trigger);
    case 'budget_exceeded': return evalBudget(root, trigger);
    case 'risk_tier': return evalRisk(trigger);
    case 'cross_boundary': return evalCrossBoundary(root, trigger);
    default: return { triggered: false, detail: `Unknown trigger: ${trigger.type}` };
  }
}

function evalScope({ touches, ownershipScope }) {
  if (!touches || !ownershipScope?.length) return { triggered: false, detail: 'No scope defined' };
  const out = touches.filter(f => !ownershipScope.some(s => f.startsWith(s)));
  return out.length > 0
    ? { triggered: true, detail: `Files outside scope: ${out.join(', ')}` }
    : { triggered: false, detail: 'All files within scope' };
}

function evalPathMatch({ touches, patterns }) {
  if (!touches || !patterns?.length) return { triggered: false, detail: 'No patterns to match' };
  const matched = [];
  for (const f of touches)
    for (const p of patterns)
      if (matchGlob(f, p)) matched.push(`${f} (${p})`);
  return matched.length > 0
    ? { triggered: true, detail: `Sensitive files: ${matched.join(', ')}` }
    : { triggered: false, detail: 'No sensitive file matches' };
}

function evalBudget(root, { roleId, threshold }) {
  const budgetPath = join(root, '.ogu/BUDGET.json');
  if (!existsSync(budgetPath)) return { triggered: false, detail: 'No budget file' };
  const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
  if (!budget.perRoleLimits?.[roleId]) return { triggered: false, detail: `No limits for ${roleId}` };

  const statePath = join(root, '.ogu/budget/budget-state.json');
  if (!existsSync(statePath)) return { triggered: false, detail: 'No budget state' };
  const state = JSON.parse(readFileSync(statePath, 'utf8'));

  const ratio = (state.daily?.costUsed || 0) / (budget.dailyLimit || 50);
  const t = threshold || 0.8;
  return ratio >= t
    ? { triggered: true, detail: `Budget at ${(ratio * 100).toFixed(1)}% (threshold: ${(t * 100).toFixed(1)}%)` }
    : { triggered: false, detail: `Budget at ${(ratio * 100).toFixed(1)}%` };
}

function evalRisk({ taskRiskTier, agentRiskTier, riskThreshold }) {
  const task = RISK_ORDER[taskRiskTier] || 2;
  const agent = RISK_ORDER[agentRiskTier] || 2;
  const thresh = RISK_ORDER[riskThreshold] || 3;
  return (task >= thresh && task > agent)
    ? { triggered: true, detail: `Task risk "${taskRiskTier}" exceeds agent "${agentRiskTier}"` }
    : { triggered: false, detail: 'Risk tier within bounds' };
}

function evalCrossBoundary(root, { roleId, touches }) {
  const org = loadOrgSpec(root);
  if (!org?.teams) return { triggered: false, detail: 'No team definitions' };
  const myTeam = org.teams.find(t => (t.roles || []).includes(roleId));
  if (!myTeam) return { triggered: false, detail: `Role ${roleId} not in any team` };

  const crossings = [];
  for (const team of org.teams.filter(t => t.teamId !== myTeam.teamId)) {
    const scope = team.ownershipScope || team.scope || [];
    for (const f of (touches || []))
      if (scope.some(s => f.startsWith(s))) crossings.push(`${f} (team: ${team.teamId})`);
  }
  return crossings.length > 0
    ? { triggered: true, detail: `Cross-boundary: ${crossings.join(', ')}` }
    : { triggered: false, detail: 'No cross-boundary access' };
}

// ── Approval resolution ──

/**
 * Check if existing approvals satisfy requirements.
 * @returns {{ satisfied, missing, granted }}
 */
export function resolveApproval(root, { featureSlug, taskName, approvals, requiredRoles }) {
  approvals = approvals || [];
  requiredRoles = requiredRoles || [];
  const granted = [], missing = [];
  for (const r of requiredRoles) {
    (approvals.find(a => a.role === r && a.status === 'approved') ? granted : missing).push(r);
  }
  return { satisfied: missing.length === 0, missing, granted };
}

// ── Violation description ──

/** Human-readable description of a governance violation. */
export function describeViolation(violation) {
  const labels = { deny: 'BLOCKED', require_approval: 'APPROVAL REQUIRED', notify: 'NOTIFICATION' };
  const label = labels[violation.action] || violation.action.toUpperCase();
  return `[${label}] ${violation.policyName} (${violation.policyId}): ${violation.detail}`;
}

// ── Policy loading ──

/** Load governance policies from .ogu/governance/policies.json. */
export function loadGovernancePolicies(root) {
  root = root || repoRoot();
  const p = join(root, '.ogu/governance/policies.json');
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')).policies || [];
}

// ── Helpers ──

function buildTriggerContext(policy, ctx) {
  const base = { type: policy.trigger, touches: ctx.touches || [], roleId: ctx.roleId };
  switch (policy.trigger) {
    case 'scope_violation': return { ...base, ownershipScope: ctx.role?.ownershipScope || [] };
    case 'path_match': return { ...base, patterns: policy.patterns || [] };
    case 'budget_exceeded': return { ...base, threshold: policy.threshold || 0.8 };
    case 'risk_tier': return { ...base, taskRiskTier: ctx.riskTier || 'medium', agentRiskTier: ctx.role?.riskTier || 'medium', riskThreshold: policy.riskThreshold || 'high' };
    case 'cross_boundary': return base;
    default: return base;
  }
}

/** Glob pattern matching: *, **, ? */
function matchGlob(filePath, pattern) {
  if (pattern.startsWith('**/')) {
    const suffix = pattern.slice(3);
    return filePath.includes(suffix) || matchGlob(filePath, suffix);
  }
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{DS}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{DS\}\}/g, '.*');
  return new RegExp(`^${escaped}$`).test(filePath);
}
