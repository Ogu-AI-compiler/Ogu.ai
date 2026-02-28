/**
 * Governance Tests — policy-ast, policy-engine, policy-resolver.
 * Tests BOTH evaluation paths: AST-based (deterministic) and legacy (direct rules).
 *
 * Run: node tools/ogu/tests/governance.test.mjs
 */

import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Imports ──

const {
  OPERATORS, evaluateCondition, evaluateRule, evaluatePolicy: evalPolicyAST,
  compileToAST, walkCondition, hashCanonical, loadCompiledAST, verifyASTFreshness,
  loadPolicyVersion, isPolicyFrozen, freezePolicy, unfreezePolicy, compileAndSave,
} = await import('../commands/lib/policy-ast.mjs');

const {
  resolveConflicts, resolveRuleConflicts, formatResolutionTrace,
} = await import('../commands/lib/policy-resolver.mjs');

const testRoot = join(tmpdir(), `ogu-gov-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/policies'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/policy'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/approvals'), { recursive: true });

console.log('\nGovernance Tests\n');

// ═══════════════════════════════════════════════════════════════════════════
// Section 1: OPERATORS (policy-ast.mjs)
// ═══════════════════════════════════════════════════════════════════════════

test('1. OPERATORS: eq — exact match', () => {
  assert(OPERATORS.eq('hello', 'hello') === true, 'Same string');
  assert(OPERATORS.eq('hello', 'world') === false, 'Different string');
  assert(OPERATORS.eq(42, 42) === true, 'Same number');
  assert(OPERATORS.eq(42, 43) === false, 'Different number');
});

test('2. OPERATORS: neq — not equal', () => {
  assert(OPERATORS.neq('a', 'b') === true, 'Different');
  assert(OPERATORS.neq('a', 'a') === false, 'Same');
});

test('3. OPERATORS: gt, gte, lt, lte — numeric comparisons', () => {
  assert(OPERATORS.gt(5, 3) === true, '5 > 3');
  assert(OPERATORS.gt(3, 5) === false, '3 > 5');
  assert(OPERATORS.gte(5, 5) === true, '5 >= 5');
  assert(OPERATORS.lt(3, 5) === true, '3 < 5');
  assert(OPERATORS.lte(5, 5) === true, '5 <= 5');
  assert(OPERATORS.gt('text', 5) === false, 'Non-numeric returns false');
});

test('4. OPERATORS: in, not_in — set membership', () => {
  assert(OPERATORS.in('a', ['a', 'b', 'c']) === true, 'a in [a,b,c]');
  assert(OPERATORS.in('d', ['a', 'b', 'c']) === false, 'd not in [a,b,c]');
  assert(OPERATORS.not_in('d', ['a', 'b', 'c']) === true, 'd not_in [a,b,c]');
  assert(OPERATORS.not_in('a', ['a', 'b', 'c']) === false, 'a not_in [a,b,c]');
});

test('5. OPERATORS: matches — regex match', () => {
  assert(OPERATORS.matches('hello world', 'hello') === true, 'Partial regex match');
  assert(OPERATORS.matches('hello', '^hello$') === true, 'Full regex match');
  assert(OPERATORS.matches('goodbye', '^hello$') === false, 'No match');
});

test('6. OPERATORS: contains — array or string contains', () => {
  assert(OPERATORS.contains(['a', 'b', 'c'], 'b') === true, 'Array contains');
  assert(OPERATORS.contains(['a', 'b', 'c'], 'd') === false, 'Array not contains');
  assert(OPERATORS.contains('hello world', 'world') === true, 'String contains');
});

test('7. OPERATORS: exists — not null/undefined', () => {
  assert(OPERATORS.exists('hello') === true, 'String exists');
  assert(OPERATORS.exists(0) === true, '0 exists');
  assert(OPERATORS.exists(null) === false, 'null not exists');
  assert(OPERATORS.exists(undefined) === false, 'undefined not exists');
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 2: evaluateCondition & evaluateRule (legacy AST exports)
// ═══════════════════════════════════════════════════════════════════════════

test('8. evaluateCondition: single leaf condition', () => {
  const ctx = { 'task.riskTier': 'critical' };
  assert(evaluateCondition({ field: 'task.riskTier', op: 'eq', value: 'critical' }, ctx) === true, 'Match');
  assert(evaluateCondition({ field: 'task.riskTier', op: 'eq', value: 'low' }, ctx) === false, 'No match');
});

test('9. evaluateRule: AND logic — all conditions must match', () => {
  const rule = {
    logic: 'AND',
    conditions: [
      { field: 'riskTier', op: 'eq', value: 'high' },
      { field: 'cost', op: 'gt', value: 10 },
    ],
  };
  assert(evaluateRule(rule, { riskTier: 'high', cost: 15 }) === true, 'Both match');
  assert(evaluateRule(rule, { riskTier: 'high', cost: 5 }) === false, 'Cost too low');
  assert(evaluateRule(rule, { riskTier: 'low', cost: 15 }) === false, 'Wrong risk');
});

test('10. evaluateRule: OR logic — any condition matches', () => {
  const rule = {
    logic: 'OR',
    conditions: [
      { field: 'riskTier', op: 'eq', value: 'critical' },
      { field: 'cost', op: 'gt', value: 100 },
    ],
  };
  assert(evaluateRule(rule, { riskTier: 'critical', cost: 5 }) === true, 'Risk matches');
  assert(evaluateRule(rule, { riskTier: 'low', cost: 150 }) === true, 'Cost matches');
  assert(evaluateRule(rule, { riskTier: 'low', cost: 5 }) === false, 'Neither matches');
});

test('11. evaluatePolicy (legacy): matches first rule', () => {
  const policy = {
    rules: [
      { id: 'r1', effect: 'deny', logic: 'and', conditions: [{ field: 'risk', op: 'eq', value: 'critical' }] },
      { id: 'r2', effect: 'permit', logic: 'and', conditions: [{ field: 'risk', op: 'eq', value: 'low' }] },
    ],
    defaultEffect: 'deny',
  };
  const result = evalPolicyAST(policy, { risk: 'critical' });
  assert(result.effect === 'deny', `Should deny, got ${result.effect}`);
  assert(result.matchedRules.includes('r1'), 'Should match r1');
});

test('12. evaluatePolicy (legacy): falls to default when no match', () => {
  const policy = {
    rules: [
      { id: 'r1', effect: 'deny', logic: 'and', conditions: [{ field: 'risk', op: 'eq', value: 'critical' }] },
    ],
    defaultEffect: 'permit',
  };
  const result = evalPolicyAST(policy, { risk: 'low' });
  assert(result.effect === 'permit', `Should permit (default), got ${result.effect}`);
  assert(result.matchedRules.length === 0, 'No rules matched');
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 3: AST Compiler
// ═══════════════════════════════════════════════════════════════════════════

test('13. compileToAST: compiles rules with effects and priority sorting', () => {
  const rulesConfig = {
    rules: [
      { id: 'low-prio', priority: 10, enabled: true, when: { field: 'risk', op: 'eq', value: 'low' }, then: [{ effect: 'allow' }] },
      { id: 'high-prio', priority: 90, enabled: true, when: { field: 'risk', op: 'eq', value: 'critical' }, then: [{ effect: 'deny', params: { reason: 'Critical risk' } }] },
      { id: 'mid-prio', priority: 50, enabled: true, when: { field: 'cost', op: 'gt', value: 100 }, then: [{ effect: 'requireApprovals', params: { count: 2 } }] },
    ],
  };

  const ast = compileToAST(rulesConfig);
  assert(ast.$schema === 'PolicyAST/1.0', 'Schema');
  assert(ast.rules.length === 3, `Should have 3 rules, got ${ast.rules.length}`);
  assert(ast.rules[0].id === 'high-prio', `First rule should be highest priority (high-prio), got ${ast.rules[0].id}`);
  assert(ast.rules[1].id === 'mid-prio', 'Second should be mid-prio');
  assert(ast.rules[2].id === 'low-prio', 'Third should be low-prio');
});

test('14. compileToAST: skips disabled rules', () => {
  const rulesConfig = {
    rules: [
      { id: 'active', priority: 50, enabled: true, when: { field: 'x', op: 'eq', value: 1 }, then: [{ effect: 'allow' }] },
      { id: 'disabled', priority: 50, enabled: false, when: { field: 'x', op: 'eq', value: 2 }, then: [{ effect: 'deny' }] },
    ],
  };
  const ast = compileToAST(rulesConfig);
  assert(ast.rules.length === 1, 'Should have 1 rule (disabled skipped)');
  assert(ast.rules[0].id === 'active', 'Only active rule');
});

test('15. compileToAST: compiles conditions into LogicalNode/LeafNode trees', () => {
  const rulesConfig = {
    rules: [{
      id: 'complex', priority: 50, enabled: true,
      when: {
        operator: 'AND',
        conditions: [
          { field: 'risk', op: 'eq', value: 'high' },
          { operator: 'OR', conditions: [
            { field: 'cost', op: 'gt', value: 50 },
            { field: 'touches', op: 'matches_any', value: ['*.env', '*.secret'] },
          ]},
        ],
      },
      then: [{ effect: 'deny' }],
    }],
  };
  const ast = compileToAST(rulesConfig);
  const rule = ast.rules[0];
  assert(rule.when.type === 'LogicalNode', 'Top-level should be LogicalNode');
  assert(rule.when.operator === 'AND', 'Top-level should be AND');
  assert(rule.when.children.length === 2, 'Should have 2 children');
  assert(rule.when.children[0].type === 'LeafNode', 'First child is leaf');
  assert(rule.when.children[1].type === 'LogicalNode', 'Second child is logical');
  assert(rule.when.children[1].operator === 'OR', 'Second child is OR');
});

test('16. compileToAST: assigns effect groups and merge strategies', () => {
  const rulesConfig = {
    rules: [
      { id: 'r1', priority: 50, enabled: true, when: { field: 'x', op: 'eq', value: 1 },
        then: [{ effect: 'requireApprovals', params: { count: 2, fromRoles: ['tech-lead'] } }] },
    ],
  };
  const ast = compileToAST(rulesConfig);
  const effect = ast.rules[0].effects[0];
  assert(effect.group === 'approval', `Group should be approval, got ${effect.group}`);
  assert(effect.merge === 'max', `Merge should be max, got ${effect.merge}`);
});

test('17. compileToAST: deterministic hash', () => {
  const rulesConfig = { rules: [{ id: 'r1', priority: 50, enabled: true, when: { field: 'x', op: 'eq', value: 1 }, then: [{ effect: 'allow' }] }] };
  const ast1 = compileToAST(rulesConfig);
  const ast2 = compileToAST(rulesConfig);
  assert(ast1.rulesHash === ast2.rulesHash, 'Same rules should produce same hash');
  assert(ast1.astHash === ast2.astHash, 'Same AST should produce same hash');
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 4: AST Walker (walkCondition)
// ═══════════════════════════════════════════════════════════════════════════

test('18. walkCondition: LeafNode matches context', () => {
  const leaf = { type: 'LeafNode', field: 'task.riskTier', op: 'eq', value: 'high' };
  assert(walkCondition(leaf, { 'task.riskTier': 'high' }) === true, 'Match');
  assert(walkCondition(leaf, { 'task.riskTier': 'low' }) === false, 'No match');
});

test('19. walkCondition: _always leaf always matches', () => {
  const leaf = { type: 'LeafNode', field: '_always', op: 'exists', value: true };
  assert(walkCondition(leaf, {}) === true, 'Always matches');
});

test('20. walkCondition: AND LogicalNode', () => {
  const node = {
    type: 'LogicalNode', operator: 'AND', shortCircuit: true,
    children: [
      { type: 'LeafNode', field: 'a', op: 'eq', value: 1 },
      { type: 'LeafNode', field: 'b', op: 'eq', value: 2 },
    ],
  };
  assert(walkCondition(node, { a: 1, b: 2 }) === true, 'Both match');
  assert(walkCondition(node, { a: 1, b: 3 }) === false, 'Second fails');
});

test('21. walkCondition: OR LogicalNode', () => {
  const node = {
    type: 'LogicalNode', operator: 'OR', shortCircuit: false,
    children: [
      { type: 'LeafNode', field: 'a', op: 'eq', value: 1 },
      { type: 'LeafNode', field: 'b', op: 'eq', value: 2 },
    ],
  };
  assert(walkCondition(node, { a: 1, b: 999 }) === true, 'First matches');
  assert(walkCondition(node, { a: 999, b: 2 }) === true, 'Second matches');
  assert(walkCondition(node, { a: 999, b: 999 }) === false, 'Neither matches');
});

test('22. walkCondition: NOT LogicalNode', () => {
  const node = {
    type: 'LogicalNode', operator: 'NOT', shortCircuit: false,
    children: [
      { type: 'LeafNode', field: 'blocked', op: 'eq', value: true },
    ],
  };
  assert(walkCondition(node, { blocked: false }) === true, 'Not blocked');
  assert(walkCondition(node, { blocked: true }) === false, 'Blocked');
});

test('23. walkCondition: nested LogicalNodes (AND > OR)', () => {
  const node = {
    type: 'LogicalNode', operator: 'AND', shortCircuit: true,
    children: [
      { type: 'LeafNode', field: 'risk', op: 'in', value: ['high', 'critical'] },
      { type: 'LogicalNode', operator: 'OR', shortCircuit: false,
        children: [
          { type: 'LeafNode', field: 'cost', op: 'gt', value: 50 },
          { type: 'LeafNode', field: 'scope', op: 'eq', value: 'infra' },
        ],
      },
    ],
  };
  assert(walkCondition(node, { risk: 'high', cost: 100, scope: '' }) === true, 'High risk + high cost');
  assert(walkCondition(node, { risk: 'critical', cost: 10, scope: 'infra' }) === true, 'Critical risk + infra scope');
  assert(walkCondition(node, { risk: 'low', cost: 100, scope: 'infra' }) === false, 'Low risk — AND fails');
  assert(walkCondition(node, { risk: 'high', cost: 10, scope: 'app' }) === false, 'High risk but neither OR');
});

test('24. walkCondition: null/undefined returns true (no condition = always pass)', () => {
  assert(walkCondition(null, {}) === true, 'null');
  assert(walkCondition(undefined, {}) === true, 'undefined');
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 5: Policy Resolver (conflict resolution)
// ═══════════════════════════════════════════════════════════════════════════

test('25. resolveConflicts (legacy): deny-overrides strategy', () => {
  const policies = [
    { id: 'p1', effect: 'permit', priority: 10 },
    { id: 'p2', effect: 'deny', priority: 5 },
    { id: 'p3', effect: 'permit', priority: 20 },
  ];
  const result = resolveConflicts(policies, 'deny-overrides');
  assert(result.effect === 'deny', `Deny should win, got ${result.effect}`);
});

test('26. resolveConflicts (legacy): highest-priority strategy', () => {
  const policies = [
    { id: 'p1', effect: 'permit', priority: 10 },
    { id: 'p2', effect: 'deny', priority: 50 },
    { id: 'p3', effect: 'permit', priority: 20 },
  ];
  const result = resolveConflicts(policies, 'highest-priority');
  assert(result.id === 'p2', `Highest priority should win, got ${result.id}`);
});

test('27. resolveConflicts (legacy): permit-overrides strategy', () => {
  const policies = [
    { id: 'p1', effect: 'deny', priority: 10 },
    { id: 'p2', effect: 'permit', priority: 5 },
  ];
  const result = resolveConflicts(policies, 'permit-overrides');
  assert(result.effect === 'permit', `Permit should win, got ${result.effect}`);
});

test('28. resolveConflicts (legacy): first-match strategy', () => {
  const policies = [
    { id: 'p1', effect: 'deny', priority: 10 },
    { id: 'p2', effect: 'permit', priority: 50 },
  ];
  const result = resolveConflicts(policies, 'first-match');
  assert(result.id === 'p1', `First should win, got ${result.id}`);
});

test('29. resolveRuleConflicts: groups effects by conflict group', () => {
  const matchedRules = [
    { id: 'r1', priority: 100, effects: [{ effect: 'deny', group: 'execution', merge: 'replace', params: { reason: 'too risky' } }] },
    { id: 'r2', priority: 50, effects: [{ effect: 'allow', group: 'execution', merge: 'replace', params: {} }] },
  ];
  const { resolved, resolutionLog } = resolveRuleConflicts(matchedRules);
  assert(resolved.execution.effect === 'deny', `Higher priority deny should win, got ${resolved.execution?.effect}`);
  assert(resolutionLog.length === 1, 'One group');
  assert(resolutionLog[0].winner === 'r1', 'r1 should win');
});

test('30. resolveRuleConflicts: max merge for approvals', () => {
  const matchedRules = [
    { id: 'r1', priority: 50, effects: [{ effect: 'requireApprovals', group: 'approval', merge: 'max', params: { count: 1 } }] },
    { id: 'r2', priority: 40, effects: [{ effect: 'requireApprovals', group: 'approval', merge: 'max', params: { count: 3 } }] },
  ];
  const { resolved } = resolveRuleConflicts(matchedRules);
  assert(resolved.approval.params.count === 3, `Max count should be 3, got ${resolved.approval?.params?.count}`);
});

test('31. resolveRuleConflicts: blocked invariant applied for deny', () => {
  const matchedRules = [
    { id: 'r1', priority: 100, effects: [{ effect: 'deny', group: 'execution', merge: 'replace', params: { reason: 'blocked' } }] },
  ];
  const { resolved } = resolveRuleConflicts(matchedRules);
  assert(resolved._blocked === true, 'Should set _blocked invariant');
});

test('32. resolveRuleConflicts: union merge for gates', () => {
  const matchedRules = [
    { id: 'r1', priority: 50, effects: [{ effect: 'addGates', group: 'gates', merge: 'union', params: { gates: ['spec-check'] } }] },
    { id: 'r2', priority: 40, effects: [{ effect: 'addGates', group: 'gates', merge: 'union', params: { gates: ['security-check'] } }] },
  ];
  const { resolved } = resolveRuleConflicts(matchedRules);
  assert(resolved.gates.params.combined.includes('spec-check'), 'Should include spec-check');
  assert(resolved.gates.params.combined.includes('security-check'), 'Should include security-check');
});

test('33. formatResolutionTrace: produces human-readable output', () => {
  const log = [{
    group: 'execution',
    strategy: 'replace',
    candidates: [{ rule: 'r1', priority: 100, effect: 'deny' }, { rule: 'r2', priority: 50, effect: 'allow' }],
    winner: 'r1',
    conflicts: [{ overridden: ['r2'], by: 'r1' }],
  }];
  const trace = formatResolutionTrace(log);
  assert(trace.includes('execution'), 'Should mention group');
  assert(trace.includes('r1'), 'Should mention winner');
  assert(trace.includes('r2'), 'Should mention loser');
  assert(trace.includes('Conflict'), 'Should mention conflict');
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 6: AST Persistence (compile, save, load, verify)
// ═══════════════════════════════════════════════════════════════════════════

test('34. hashCanonical: same object → same hash', () => {
  const h1 = hashCanonical({ a: 1, b: 2 });
  const h2 = hashCanonical({ a: 1, b: 2 });
  assert(h1 === h2, `Hashes should match: ${h1} vs ${h2}`);
  assert(h1.startsWith('sha256:'), 'Should start with sha256:');
});

test('35. hashCanonical: different object → different hash', () => {
  const h1 = hashCanonical({ a: 1 });
  const h2 = hashCanonical({ a: 2 });
  assert(h1 !== h2, 'Different objects should have different hashes');
});

test('36. AST can be serialized to disk and loaded back', () => {
  const rulesConfig = {
    rules: [
      { id: 'test-rule', priority: 50, enabled: true, when: { field: 'x', op: 'eq', value: 1 }, then: [{ effect: 'allow' }] },
    ],
  };
  const ast = compileToAST(rulesConfig);
  const astPath = join(testRoot, '.ogu/policy/policy.ast.json');
  writeFileSync(astPath, JSON.stringify(ast, null, 2), 'utf8');

  const loaded = JSON.parse(readFileSync(astPath, 'utf8'));
  assert(loaded.$schema === 'PolicyAST/1.0', 'Schema preserved');
  assert(loaded.rules.length === 1, 'Rules preserved');
  assert(loaded.rules[0].id === 'test-rule', 'Rule ID preserved');
  assert(loaded.astHash === ast.astHash, 'Hash preserved');
});

test('37. Policy version chain tracks history', () => {
  const versionPath = join(testRoot, '.ogu/policy/policy-version.json');
  const chain = {
    current: { version: 3, rulesHash: 'sha256:abc', astHash: 'sha256:def', compiledAt: new Date().toISOString(), ruleCount: 5 },
    history: [
      { version: 2, rulesHash: 'sha256:old2', author: 'user', changedRules: ['added:new-rule'] },
      { version: 1, rulesHash: 'sha256:old1', author: 'user', changedRules: [] },
    ],
  };
  writeFileSync(versionPath, JSON.stringify(chain, null, 2), 'utf8');
  const loaded = JSON.parse(readFileSync(versionPath, 'utf8'));
  assert(loaded.current.version === 3, 'Current version');
  assert(loaded.history.length === 2, 'History preserved');
  assert(loaded.history[0].changedRules.includes('added:new-rule'), 'Change tracked');
});

test('38. Policy freeze and unfreeze', () => {
  const versionPath = join(testRoot, '.ogu/policy/policy-version.json');
  writeFileSync(versionPath, JSON.stringify({ current: { version: 1 }, history: [] }), 'utf8');

  // Freeze
  const frozen = JSON.parse(readFileSync(versionPath, 'utf8'));
  frozen.frozen = true;
  frozen.frozenAt = new Date().toISOString();
  writeFileSync(versionPath, JSON.stringify(frozen, null, 2), 'utf8');
  const loadedFrozen = JSON.parse(readFileSync(versionPath, 'utf8'));
  assert(loadedFrozen.frozen === true, 'Should be frozen');

  // Unfreeze
  loadedFrozen.frozen = false;
  delete loadedFrozen.frozenAt;
  writeFileSync(versionPath, JSON.stringify(loadedFrozen, null, 2), 'utf8');
  const loadedUnfrozen = JSON.parse(readFileSync(versionPath, 'utf8'));
  assert(loadedUnfrozen.frozen === false, 'Should be unfrozen');
});

// ═══════════════════════════════════════════════════════════════════════════
// Section 7: Full Pipeline — rules.json → AST → evaluate → resolve
// ═══════════════════════════════════════════════════════════════════════════

test('39. Full pipeline: compile rules → walk AST → resolve effects', () => {
  const rulesConfig = {
    version: 1,
    rules: [
      {
        id: 'block-critical-infra', priority: 90, enabled: true,
        when: {
          operator: 'AND',
          conditions: [
            { field: 'task.riskTier', op: 'eq', value: 'critical' },
            { field: 'task.touches', op: 'matches_any', value: ['*.env', '*.secret', 'infra/**'] },
          ],
        },
        then: [{ effect: 'deny', params: { reason: 'Critical infrastructure change requires manual approval' } }],
      },
      {
        id: 'require-approval-high', priority: 70, enabled: true,
        when: { field: 'task.riskTier', op: 'in', value: ['high', 'critical'] },
        then: [{ effect: 'requireApprovals', params: { count: 2, fromRoles: ['tech-lead', 'security'] } }],
      },
      {
        id: 'allow-low-risk', priority: 10, enabled: true,
        when: { field: 'task.riskTier', op: 'in', value: ['low', 'medium'] },
        then: [{ effect: 'allow', params: {} }],
      },
    ],
  };

  // Step 1: Compile
  const ast = compileToAST(rulesConfig);
  assert(ast.rules.length === 3, 'All 3 rules compiled');
  assert(ast.rules[0].id === 'block-critical-infra', 'Highest priority first');

  // Step 2: Evaluate against context
  const context = {
    'task.riskTier': 'critical',
    'task.touches': ['.env'],
  };

  const matched = [];
  for (const ruleNode of ast.rules) {
    if (walkCondition(ruleNode.when, context)) {
      matched.push(ruleNode);
    }
  }

  assert(matched.length === 2, `Should match 2 rules (block-critical + require-approval), got ${matched.length}`);
  assert(matched[0].id === 'block-critical-infra', 'First matched is block-critical');
  assert(matched[1].id === 'require-approval-high', 'Second matched is require-approval');

  // Step 3: Resolve conflicts
  const { resolved } = resolveRuleConflicts(matched);
  assert(resolved._blocked === true, 'Should be blocked (deny invariant)');
  assert(resolved.execution.effect === 'deny', 'Execution effect should be deny');
});

test('40. Full pipeline: low risk context → ALLOW', () => {
  const rulesConfig = {
    version: 1,
    rules: [
      { id: 'block-critical', priority: 90, enabled: true, when: { field: 'task.riskTier', op: 'eq', value: 'critical' }, then: [{ effect: 'deny' }] },
      { id: 'allow-low', priority: 10, enabled: true, when: { field: 'task.riskTier', op: 'in', value: ['low', 'medium'] }, then: [{ effect: 'allow' }] },
    ],
  };
  const ast = compileToAST(rulesConfig);

  const matched = [];
  for (const ruleNode of ast.rules) {
    if (walkCondition(ruleNode.when, { 'task.riskTier': 'low' })) {
      matched.push(ruleNode);
    }
  }

  assert(matched.length === 1, 'Should match only allow-low');
  assert(matched[0].id === 'allow-low', 'Matched rule is allow-low');

  const { resolved } = resolveRuleConflicts(matched);
  assert(!resolved._blocked, 'Should not be blocked');
  assert(resolved.execution.effect === 'allow', 'Should be allowed');
});

test('41. Full pipeline: empty rules → no matches → default allow', () => {
  const ast = compileToAST({ rules: [] });
  assert(ast.rules.length === 0, 'No rules');

  const matched = [];
  for (const ruleNode of ast.rules) {
    if (walkCondition(ruleNode.when, { 'task.riskTier': 'medium' })) {
      matched.push(ruleNode);
    }
  }

  assert(matched.length === 0, 'No matches');
  const { resolved } = resolveRuleConflicts(matched);
  assert(Object.keys(resolved).length === 0, 'No effects resolved');
});

test('42. Unless clause prevents rule from firing', () => {
  const rulesConfig = {
    rules: [{
      id: 'r1', priority: 50, enabled: true,
      when: { field: 'task.riskTier', op: 'eq', value: 'high' },
      unless: { field: 'task.roleId', op: 'eq', value: 'tech-lead' },
      then: [{ effect: 'requireApprovals', params: { count: 1 } }],
    }],
  };
  const ast = compileToAST(rulesConfig);
  const rule = ast.rules[0];

  // High risk + not tech-lead → should fire
  const matchNormal = walkCondition(rule.when, { 'task.riskTier': 'high' }) && !walkCondition(rule.unless, { 'task.roleId': 'developer' });
  assert(matchNormal === true, 'Should fire for non-tech-lead');

  // High risk + tech-lead → unless prevents
  const matchTechLead = walkCondition(rule.when, { 'task.riskTier': 'high' }) && !walkCondition(rule.unless, { 'task.roleId': 'tech-lead' });
  assert(matchTechLead === false, 'Should NOT fire for tech-lead');
});

// ── Cleanup ──
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
