import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { minimatch } from '../../lib/minimatch.mjs';
import { repoRoot } from '../../util.mjs';
import { loadCompiledAST, verifyASTFreshness, walkCondition, loadPolicyVersion, isPolicyFrozen, hashCanonical } from './policy-ast.mjs';
import { resolveRuleConflicts, formatResolutionTrace } from './policy-resolver.mjs';

/**
 * Declarative Policy Engine — Deterministic Evaluation Pipeline.
 *
 * Evaluation order:
 * 1. Load compiled AST (NOT raw rules)
 * 2. Verify AST freshness
 * 3. Walk AST — evaluation order is pre-sorted, deterministic
 * 4. Resolve conflicts (deterministic resolver)
 * 5. Apply hardcoded invariants
 * 6. Build evaluation receipt
 */

const RULES_PATH = () => join(repoRoot(), '.ogu/policies/rules.json');
const APPROVALS_DIR = () => join(repoRoot(), '.ogu/approvals');

/**
 * Load policy rules from disk.
 * @returns {{ version: number, rules: object[] } | null}
 */
export function loadRules() {
  const path = RULES_PATH();
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Evaluate all rules against a task context.
 * Uses compiled AST when available, falls back to raw rules.
 *
 * @param {object} context - Task evaluation context
 * @returns {{ decision: string, matchedRules: object[], effects: object[], reason: string, deterministic?: boolean, astVersion?: string, resolutionLog?: Array }}
 */
export function evaluatePolicy(context) {
  const root = context._root || repoRoot();

  // Try AST-based evaluation first
  const ast = loadCompiledAST(root);
  if (ast) {
    const freshness = verifyASTFreshness(root);
    if (freshness.fresh) {
      return evaluateViaAST(root, ast, context);
    }
    // AST stale — fall through to legacy
  }

  // Legacy: direct rules evaluation
  return evaluateLegacy(context);
}

/**
 * AST-based deterministic evaluation.
 */
function evaluateViaAST(root, ast, context) {
  // Build flat evaluation context
  const evalCtx = buildEvalContext(context);

  // Walk AST — evaluation order is AST order (pre-sorted, deterministic)
  const matched = [];
  for (const ruleNode of ast.rules) {
    const whenResult = walkCondition(ruleNode.when, evalCtx);
    const unlessResult = ruleNode.unless ? walkCondition(ruleNode.unless, evalCtx) : false;

    if (whenResult && !unlessResult) {
      matched.push(ruleNode);
    }
  }

  // Resolve conflicts (deterministic resolver)
  const { resolved, resolutionLog } = resolveRuleConflicts(matched);

  // Determine decision
  const decision = deriveDecision(resolved, matched, context);

  // Build evaluation receipt
  const policyVersion = loadPolicyVersion(root);
  return {
    decision: decision.decision,
    matchedRules: matched.map(r => ({ id: r.id, priority: r.priority })),
    effects: Object.values(resolved).flat(),
    reason: decision.reason,
    resolutionLog,
    astVersion: ast.compiledAt,
    astHash: ast.astHash,
    policyVersion: policyVersion.current?.version || 0,
    evaluatedAt: new Date().toISOString(),
    deterministic: true,
  };
}

/**
 * Derive decision from resolved effects.
 */
function deriveDecision(resolved, matched, context) {
  // Check for blocked
  if (resolved._blocked) {
    const blockEffect = resolved.execution;
    return {
      decision: 'DENY',
      reason: blockEffect?.params?.reason || `Blocked by policy rule`,
    };
  }

  // Check for approval requirements
  if (resolved.approval?.effect === 'requireApprovals') {
    const hasApproval = checkExistingApprovals(context, [resolved.approval]);
    if (hasApproval) {
      return { decision: 'ALLOW', reason: 'Required approvals have been granted' };
    }
    const params = resolved.approval.params || {};
    return {
      decision: 'REQUIRES_APPROVAL',
      reason: `Requires ${params.count || 1} approval(s) from ${(params.fromRoles || []).join(', ')}`,
    };
  }

  // Check for explicit deny in execution group
  if (resolved.execution?.effect === 'deny') {
    return {
      decision: 'DENY',
      reason: resolved.execution.params?.reason || 'Denied by policy',
    };
  }

  // Check for explicit allow
  if (resolved.execution?.effect === 'allow') {
    return { decision: 'ALLOW', reason: 'Allowed by policy' };
  }

  // No blocking effects
  if (matched.length === 0) {
    return { decision: 'ALLOW', reason: 'No matching rules — default allow' };
  }

  return { decision: 'ALLOW', reason: 'Non-blocking effects only' };
}

/**
 * Legacy evaluation (direct rules, no AST).
 */
function evaluateLegacy(context) {
  const ruleSet = loadRules();
  if (!ruleSet || !ruleSet.rules || ruleSet.rules.length === 0) {
    return {
      decision: 'ALLOW',
      matchedRules: [],
      effects: [],
      reason: 'No policy rules defined — default allow',
    };
  }

  const evalCtx = buildEvalContext(context);

  const activeRules = ruleSet.rules
    .filter(r => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  const matchedRules = [];
  const allEffects = [];

  for (const rule of activeRules) {
    if (evaluateConditionLegacy(rule.when, evalCtx)) {
      matchedRules.push({ id: rule.id, name: rule.name, priority: rule.priority });
      for (const effect of rule.then) {
        allEffects.push({ ...effect, ruleId: rule.id });
      }
    }
  }

  const decision = resolveDecision(allEffects, context);

  return {
    decision: decision.decision,
    matchedRules,
    effects: allEffects,
    reason: decision.reason,
  };
}

/**
 * Build flat evaluation context from task context.
 */
function buildEvalContext(context) {
  return {
    'task.name': context.taskName || '',
    'task.riskTier': context.riskTier || 'medium',
    'task.touches': context.touches || [],
    'task.capability': context.capability || 'code_generation',
    'task.roleId': context.roleId || '',
    'task.failureCount': context.failureCount || 0,
    'task.estimatedCost': context.estimatedCost || 0,
    'feature.slug': context.featureSlug || '',
    'feature.currentState': context.featureState || 'building',
    'budget.exceeded': context.budgetExceeded || false,
    'budget.remaining': context.budgetRemaining ?? Infinity,
    'scope.violation': context.scopeViolation || false,
    'trigger': context.trigger || 'manual',
    // Forward all original context keys
    ...context,
  };
}

/**
 * Legacy: Evaluate a condition group against context.
 */
function evaluateConditionLegacy(condition, ctx) {
  if (!condition) return true;

  if (condition.field) {
    return evaluateLeaf(condition, ctx);
  }

  const { operator, conditions } = condition;
  if (!conditions || conditions.length === 0) return true;

  switch (operator) {
    case 'AND':
      return conditions.every(c => evaluateConditionLegacy(c, ctx));
    case 'OR':
      return conditions.some(c => evaluateConditionLegacy(c, ctx));
    case 'NOT':
      return !conditions.some(c => evaluateConditionLegacy(c, ctx));
    default:
      return false;
  }
}

/**
 * Legacy: Evaluate a single leaf condition.
 */
function evaluateLeaf(leaf, ctx) {
  const { field, op, value } = leaf;
  const actual = ctx[field];

  switch (op) {
    case 'eq':
      return actual === value;
    case 'neq':
      return actual !== value;
    case 'in':
      return Array.isArray(value) && value.includes(actual);
    case 'not_in':
      return Array.isArray(value) && !value.includes(actual);
    case 'gt':
      return typeof actual === 'number' && actual > value;
    case 'lt':
      return typeof actual === 'number' && actual < value;
    case 'gte':
      return typeof actual === 'number' && actual >= value;
    case 'lte':
      return typeof actual === 'number' && actual <= value;
    case 'matches':
      return typeof actual === 'string' && minimatch(actual, value);
    case 'matches_any': {
      const paths = Array.isArray(actual) ? actual : [actual];
      const patterns = Array.isArray(value) ? value : [value];
      return paths.some(p => patterns.some(pat => minimatch(p, pat)));
    }
    case 'exists':
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
}

/**
 * Legacy: Resolve the final decision from a list of effects.
 */
function resolveDecision(effects, context) {
  const denyEffect = effects.find(e => e.effect === 'deny');
  if (denyEffect) {
    return {
      decision: 'DENY',
      reason: denyEffect.params?.reason || `Denied by rule ${denyEffect.ruleId}`,
    };
  }

  const approvalEffects = effects.filter(e => e.effect === 'requireApprovals');
  if (approvalEffects.length > 0) {
    const hasApproval = checkExistingApprovals(context, approvalEffects);
    if (hasApproval) {
      return { decision: 'ALLOW', reason: 'Required approvals have been granted' };
    }
    return {
      decision: 'REQUIRES_APPROVAL',
      reason: approvalEffects.map(e =>
        `Requires ${e.params.count || 1} approval(s) from ${(e.params.fromRoles || []).join(', ')} (rule: ${e.ruleId})`
      ).join('; '),
    };
  }

  const allowEffect = effects.find(e => e.effect === 'allow');
  if (allowEffect) {
    return { decision: 'ALLOW', reason: `Allowed by rule ${allowEffect.ruleId}` };
  }

  if (effects.length === 0) {
    return { decision: 'ALLOW', reason: 'No matching rules — default allow' };
  }

  return { decision: 'ALLOW', reason: 'Non-blocking effects only' };
}

/**
 * Check if required approvals already exist on disk.
 */
function checkExistingApprovals(context, approvalEffects) {
  const dir = APPROVALS_DIR();
  if (!existsSync(dir)) return false;

  for (const effect of approvalEffects) {
    const requiredCount = effect.params?.count || 1;
    const requiredRoles = effect.params?.fromRoles || [];

    const approvalFile = join(dir, `${context.featureSlug}-${context.taskName}.json`);
    if (!existsSync(approvalFile)) return false;

    const approvals = JSON.parse(readFileSync(approvalFile, 'utf8'));
    const validApprovals = approvals.filter(a =>
      a.status === 'approved' &&
      (requiredRoles.length === 0 || requiredRoles.includes(a.role))
    );

    if (validApprovals.length < requiredCount) return false;
  }

  return true;
}

/**
 * Capture policy binding for execution snapshot.
 * Returns binding + verify function for policy drift detection.
 */
export function capturePolicyBinding(root, context) {
  root = root || repoRoot();
  const policyVersion = loadPolicyVersion(root);
  const evaluation = evaluatePolicy({ ...context, _root: root });

  return {
    policyVersionAtStart: policyVersion.current?.version || 0,
    rulesHashAtStart: policyVersion.current?.rulesHash || null,
    astHashAtStart: policyVersion.current?.astHash || null,
    evaluationResult: evaluation,
    evaluationHash: hashCanonical(evaluation),
  };
}

/**
 * Verify policy binding hasn't changed since start.
 */
export function verifyPolicyBinding(root, binding) {
  root = root || repoRoot();
  const currentVersion = loadPolicyVersion(root);
  if (currentVersion.current?.version !== binding.policyVersionAtStart) {
    return {
      valid: false,
      error: 'OGU3603: Policy version changed during execution',
      before: binding.policyVersionAtStart,
      after: currentVersion.current?.version,
    };
  }
  return { valid: true };
}
