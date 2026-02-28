/**
 * Policy AST — compile rules.json → typed AST for deterministic evaluation.
 *
 * The AST is the ONLY thing the evaluator reads. Raw rules.json is never
 * evaluated directly. If rules.json changes and the AST is stale, OGU3602.
 *
 * Node types: RuleNode, LogicalNode, LeafNode, EffectNode
 *
 * Operators:
 *   eq, neq, gt, gte, lt, lte, in, not_in, matches, matches_any, contains, exists
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

// ── Legacy exports (backwards compat) ──────────────────────────────────

export const OPERATORS = {
  eq:       (a, b) => a === b,
  neq:      (a, b) => a !== b,
  gt:       (a, b) => typeof a === 'number' && a > b,
  lt:       (a, b) => typeof a === 'number' && a < b,
  gte:      (a, b) => typeof a === 'number' && a >= b,
  lte:      (a, b) => typeof a === 'number' && a <= b,
  in:       (a, b) => Array.isArray(b) && b.includes(a),
  not_in:   (a, b) => Array.isArray(b) && !b.includes(a),
  matches:  (a, b) => typeof a === 'string' && new RegExp(b).test(a),
  matches_any: (a, b) => Array.isArray(b) && b.some(p => globMatch(p, String(a))),
  contains: (a, b) => Array.isArray(a) ? a.includes(b) : (typeof a === 'string' && a.includes(String(b))),
  exists:   (a) => a !== undefined && a !== null,
};

export const EFFECTS = ['permit', 'deny', 'audit_only', 'escalate'];

/** Legacy: evaluate a single condition */
export function evaluateCondition(condition, context) {
  const { field, op, value } = condition;
  const actual = context[field];
  const operator = OPERATORS[op];
  if (!operator) return false;
  return operator(actual, value);
}

/** Legacy: evaluate rule with AND/OR */
export function evaluateRule(rule, context) {
  const { logic = 'and', conditions = [] } = rule;
  if (conditions.length === 0) return true;
  const logicLower = logic.toLowerCase();
  if (logicLower === 'or') return conditions.some(c => evaluateCondition(c, context));
  return conditions.every(c => evaluateCondition(c, context));
}

/** Legacy: evaluate full policy */
export function evaluatePolicy(policy, context) {
  const matchedRules = [];
  for (const rule of (policy.rules || [])) {
    if (evaluateRule(rule, context)) {
      matchedRules.push(rule.id || 'anonymous');
      return { effect: rule.effect || 'deny', matchedRules };
    }
  }
  return { effect: policy.defaultEffect || 'deny', matchedRules };
}

// ── AST Compiler ────────────────────────────────────────────────────────

const AST_DIR = () => join(repoRoot(), '.ogu/policy');
const AST_PATH = () => join(AST_DIR(), 'policy.ast.json');
const VERSION_PATH = () => join(AST_DIR(), 'policy-version.json');
const RULES_PATH = () => join(repoRoot(), '.ogu/policies/rules.json');

/** Effect → Conflict Group mapping */
const EFFECT_GROUP_MAP = {
  requireApprovals:    'approval',
  autoApprove:         'approval',
  blockExecution:      'execution',
  deny:                'execution',
  allow:               'execution',
  setMinModelTier:     'model_tier',
  downgradeModelTier:  'model_tier',
  addGates:            'gates',
  addReviewers:        'approval',
  throttleConcurrency: 'concurrency',
  forceSandbox:        'sandbox',
  emitAlert:           'notification',
  tagForAudit:         'audit',
  escalate:            'execution',
};

/** Effect → Merge strategy when multiple rules fire same group */
const EFFECT_MERGE_MAP = {
  requireApprovals:    'max',
  autoApprove:         'replace',
  blockExecution:      'replace',
  deny:                'replace',
  allow:               'replace',
  setMinModelTier:     'max',
  downgradeModelTier:  'min',
  addGates:            'union',
  addReviewers:        'union',
  throttleConcurrency: 'min',
  forceSandbox:        'max',
  emitAlert:           'append',
  tagForAudit:         'union',
  escalate:            'replace',
};

/**
 * Compile raw rules.json → typed AST.
 * Every rule becomes a RuleNode with typed children.
 * The AST is the ONLY thing the evaluator reads.
 */
export function compileToAST(rulesConfig) {
  const ast = {
    $schema: 'PolicyAST/1.0',
    compiledAt: new Date().toISOString(),
    rules: [],
    effectGroups: [],
    rulesHash: hashCanonical(rulesConfig.rules || []),
  };

  const groupsSet = new Set();

  for (const rule of (rulesConfig.rules || [])) {
    if (rule.enabled === false) continue;

    const effects = (rule.then || []).map(e => compileEffect(e));
    for (const eff of effects) {
      if (eff.group) groupsSet.add(eff.group);
    }

    const ruleNode = {
      type: 'RuleNode',
      id: rule.id,
      priority: normalizePriority(rule.priority),
      group: inferConflictGroup(rule.then),
      when: compileCondition(rule.when),
      unless: rule.unless ? compileCondition(rule.unless) : null,
      effects,
      version: rule.version || 1,
      hash: hashCanonical(rule),
    };

    ast.rules.push(ruleNode);
  }

  // Sort: primary by priority DESC, secondary by id ASC (deterministic tiebreak)
  ast.rules.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });

  ast.effectGroups = [...groupsSet].sort();
  ast.astHash = hashCanonical(ast.rules);
  ast.ruleCount = ast.rules.length;

  return ast;
}

/**
 * Compile a condition block → LogicalNode or LeafNode tree
 */
function compileCondition(condition) {
  if (!condition) return { type: 'LeafNode', field: '_always', op: 'exists', value: true, fieldType: 'boolean', hash: hashCanonical({ always: true }) };

  if (condition.operator) {
    return {
      type: 'LogicalNode',
      operator: condition.operator,
      children: (condition.conditions || []).map(c => compileCondition(c)),
      shortCircuit: condition.operator === 'AND',
    };
  }

  // Leaf condition
  return {
    type: 'LeafNode',
    field: condition.field,
    op: condition.op,
    value: condition.value,
    fieldType: inferFieldType(condition.value),
    hash: hashCanonical({ field: condition.field, op: condition.op, value: condition.value }),
  };
}

/**
 * Compile an effect → EffectNode with merge strategy
 */
function compileEffect(effect) {
  const effectType = effect.effect;
  return {
    type: 'EffectNode',
    effect: effectType,
    params: effect.params || {},
    group: EFFECT_GROUP_MAP[effectType] || 'unknown',
    merge: EFFECT_MERGE_MAP[effectType] || 'replace',
  };
}

function inferConflictGroup(effects) {
  if (!effects || effects.length === 0) return 'unknown';
  return EFFECT_GROUP_MAP[effects[0].effect] || 'unknown';
}

function normalizePriority(raw) {
  return Math.round((raw || 50) * 10);
}

function inferFieldType(value) {
  if (Array.isArray(value)) return 'string[]';
  return typeof value;
}

// ── AST Persistence ─────────────────────────────────────────────────────

/**
 * Compile rules.json → AST and write to disk.
 * Bumps version chain.
 */
export function compileAndSave(root) {
  root = root || repoRoot();
  const rulesPath = join(root, '.ogu/policies/rules.json');
  if (!existsSync(rulesPath)) {
    return { error: 'OGU3600: No rules.json found at .ogu/policies/rules.json' };
  }

  const rulesConfig = JSON.parse(readFileSync(rulesPath, 'utf8'));
  const ast = compileToAST(rulesConfig);

  // Ensure directory
  const dir = join(root, '.ogu/policy');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Write AST
  writeFileSync(join(dir, 'policy.ast.json'), JSON.stringify(ast, null, 2), 'utf8');

  // Update version chain
  const versionChain = loadPolicyVersion(root);
  const previousVersion = versionChain.current ? { ...versionChain.current } : null;

  const newVersion = {
    version: (versionChain.current?.version || 0) + 1,
    rulesHash: ast.rulesHash,
    astHash: ast.astHash,
    compiledAt: ast.compiledAt,
    ruleCount: ast.ruleCount,
    effectGroups: ast.effectGroups,
  };

  if (previousVersion) {
    // Detect changed rules
    const prevAST = loadCompiledAST(root);
    const prevIds = new Set((prevAST?.rules || []).map(r => r.id));
    const newIds = new Set(ast.rules.map(r => r.id));
    const changedRules = [];
    for (const id of newIds) { if (!prevIds.has(id)) changedRules.push(`added:${id}`); }
    for (const id of prevIds) { if (!newIds.has(id)) changedRules.push(`removed:${id}`); }

    versionChain.history = versionChain.history || [];
    versionChain.history.unshift({
      ...previousVersion,
      changedRules,
      author: process.env.USER || 'system',
    });

    // Keep last 50 versions
    if (versionChain.history.length > 50) versionChain.history.length = 50;
  }

  versionChain.current = newVersion;
  versionChain.lockContract = {
    description: 'Policy version MUST NOT change during a feature execution. If it does, all in-flight tasks must re-evaluate.',
    enforcedBy: 'execution-snapshot.mjs checks policyVersion at start and end of each task',
  };

  writeFileSync(join(dir, 'policy-version.json'), JSON.stringify(versionChain, null, 2), 'utf8');

  return { ast, version: newVersion };
}

/**
 * Load compiled AST from disk.
 * @returns {object|null}
 */
export function loadCompiledAST(root) {
  root = root || repoRoot();
  const path = join(root, '.ogu/policy/policy.ast.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

/**
 * Load policy version chain.
 */
export function loadPolicyVersion(root) {
  root = root || repoRoot();
  const path = join(root, '.ogu/policy/policy-version.json');
  if (!existsSync(path)) return { current: null, history: [] };
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return { current: null, history: [] }; }
}

/**
 * Verify that AST is fresh (matches current rules.json).
 * @returns {{ fresh: boolean, error?: string }}
 */
export function verifyASTFreshness(root) {
  root = root || repoRoot();
  const ast = loadCompiledAST(root);
  if (!ast) return { fresh: false, error: 'OGU3601: No compiled AST. Run ogu policy:compile first.' };

  const rulesPath = join(root, '.ogu/policies/rules.json');
  if (!existsSync(rulesPath)) return { fresh: false, error: 'OGU3600: No rules.json found.' };

  const rulesConfig = JSON.parse(readFileSync(rulesPath, 'utf8'));
  const currentHash = hashCanonical(rulesConfig.rules || []);

  if (currentHash !== ast.rulesHash) {
    return { fresh: false, error: 'OGU3602: AST stale — rules.json changed since last compile. Run ogu policy:compile.' };
  }

  return { fresh: true };
}

// ── AST Walker (used by policy-engine) ──────────────────────────────────

/**
 * Walk an AST condition node against context.
 * This is the deterministic evaluator that replaces raw rule evaluation.
 */
export function walkCondition(node, context) {
  if (!node) return true;

  if (node.type === 'LogicalNode') {
    const { operator, children, shortCircuit } = node;
    if (operator === 'AND') {
      for (const child of children) {
        const result = walkCondition(child, context);
        if (!result && shortCircuit) return false;
        if (!result) return false;
      }
      return true;
    }
    if (operator === 'OR') {
      for (const child of children) {
        if (walkCondition(child, context)) return true;
      }
      return false;
    }
    if (operator === 'NOT') {
      return !children.some(c => walkCondition(c, context));
    }
    return false;
  }

  if (node.type === 'LeafNode') {
    const { field, op, value } = node;
    if (field === '_always') return true;
    const actual = resolveField(context, field);
    const operatorFn = OPERATORS[op];
    if (!operatorFn) return false;
    return operatorFn(actual, value);
  }

  return false;
}

/**
 * Resolve a dotted field path from context.
 */
function resolveField(context, field) {
  if (field in context) return context[field];
  // Support dotted paths
  const parts = field.split('.');
  let obj = context;
  for (const part of parts) {
    if (obj == null) return undefined;
    obj = obj[part];
  }
  return obj;
}

// ── Policy Freeze ───────────────────────────────────────────────────────

/**
 * Freeze policy — prevent changes during execution.
 */
export function freezePolicy(root) {
  root = root || repoRoot();
  const version = loadPolicyVersion(root);
  version.frozen = true;
  version.frozenAt = new Date().toISOString();
  version.frozenBy = process.env.USER || 'system';
  const dir = join(root, '.ogu/policy');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'policy-version.json'), JSON.stringify(version, null, 2), 'utf8');
  return { frozen: true };
}

/**
 * Unfreeze policy.
 */
export function unfreezePolicy(root) {
  root = root || repoRoot();
  const version = loadPolicyVersion(root);
  version.frozen = false;
  delete version.frozenAt;
  delete version.frozenBy;
  writeFileSync(join(root, '.ogu/policy/policy-version.json'), JSON.stringify(version, null, 2), 'utf8');
  return { frozen: false };
}

/**
 * Check if policy is frozen.
 */
export function isPolicyFrozen(root) {
  const version = loadPolicyVersion(root);
  return !!version.frozen;
}

// ── Hashing ─────────────────────────────────────────────────────────────

export function hashCanonical(obj) {
  const canonical = JSON.stringify(obj, Object.keys(typeof obj === 'object' && obj !== null ? obj : {}).sort());
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function globMatch(pattern, str) {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(str);
}
