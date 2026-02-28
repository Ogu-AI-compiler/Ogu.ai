/**
 * Policy AST Tests — compile, walk, freeze, freshness, versioning.
 *
 * Run: node tools/ogu/tests/policy-ast.test.mjs
 */

import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const {
  OPERATORS, EFFECTS, evaluateCondition, evaluateRule, evaluatePolicy,
  compileToAST, compileAndSave, loadCompiledAST, loadPolicyVersion,
  verifyASTFreshness, walkCondition, hashCanonical,
  freezePolicy, unfreezePolicy, isPolicyFrozen,
} = await import('../commands/lib/policy-ast.mjs');

// ── Setup ──

const testRoot = join(tmpdir(), `ogu-ast-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/policies'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/policy'), { recursive: true });

function makeRules(rules, defaults = {}) {
  return { $schema: 'PolicyRules/1.0', rules, ...defaults };
}

const sampleRules = makeRules([
  {
    id: 'rule-high-risk',
    priority: 80,
    enabled: true,
    when: { field: 'riskTier', op: 'eq', value: 'high' },
    then: [{ effect: 'requireApprovals', params: { count: 2 } }],
  },
  {
    id: 'rule-auth-files',
    priority: 60,
    enabled: true,
    when: {
      operator: 'AND',
      conditions: [
        { field: 'touches', op: 'contains', value: 'auth' },
        { field: 'riskTier', op: 'neq', value: 'low' },
      ],
    },
    then: [{ effect: 'forceSandbox', params: {} }],
  },
  {
    id: 'rule-disabled',
    priority: 90,
    enabled: false,
    when: { field: 'riskTier', op: 'eq', value: 'low' },
    then: [{ effect: 'allow', params: {} }],
  },
]);

console.log('\nPolicy AST Tests\n');

// ── Section 1: OPERATORS ──

test('1. OPERATORS eq — exact match', () => {
  assert(OPERATORS.eq('high', 'high'));
  assert(!OPERATORS.eq('high', 'low'));
});

test('2. OPERATORS neq — not equal', () => {
  assert(OPERATORS.neq('high', 'low'));
  assert(!OPERATORS.neq('a', 'a'));
});

test('3. OPERATORS gt/gte/lt/lte — numeric', () => {
  assert(OPERATORS.gt(5, 3));
  assert(!OPERATORS.gt(3, 5));
  assert(OPERATORS.gte(5, 5));
  assert(OPERATORS.lt(3, 5));
  assert(OPERATORS.lte(5, 5));
});

test('4. OPERATORS in/not_in — array membership', () => {
  assert(OPERATORS.in('a', ['a', 'b', 'c']));
  assert(!OPERATORS.in('d', ['a', 'b', 'c']));
  assert(OPERATORS.not_in('d', ['a', 'b', 'c']));
});

test('5. OPERATORS matches — regex', () => {
  assert(OPERATORS.matches('src/auth/login.ts', 'auth'));
  assert(!OPERATORS.matches('src/utils.ts', 'auth'));
});

test('6. OPERATORS contains — array and string', () => {
  assert(OPERATORS.contains(['a', 'b', 'c'], 'b'));
  assert(OPERATORS.contains('hello world', 'world'));
  assert(!OPERATORS.contains(['a', 'b'], 'z'));
});

test('7. OPERATORS exists — checks not null/undefined', () => {
  assert(OPERATORS.exists('something'));
  assert(OPERATORS.exists(0));
  assert(!OPERATORS.exists(null));
  assert(!OPERATORS.exists(undefined));
});

test('8. EFFECTS constant', () => {
  assert(EFFECTS.includes('permit'));
  assert(EFFECTS.includes('deny'));
  assert(EFFECTS.includes('escalate'));
  assert(EFFECTS.includes('audit_only'));
});

// ── Section 2: Legacy evaluate ──

test('9. evaluateCondition — simple field match', () => {
  assert(evaluateCondition({ field: 'riskTier', op: 'eq', value: 'high' }, { riskTier: 'high' }));
  assert(!evaluateCondition({ field: 'riskTier', op: 'eq', value: 'high' }, { riskTier: 'low' }));
});

test('10. evaluateRule — AND logic', () => {
  const rule = { logic: 'and', conditions: [
    { field: 'riskTier', op: 'eq', value: 'high' },
    { field: 'phase', op: 'eq', value: 'build' },
  ]};
  assert(evaluateRule(rule, { riskTier: 'high', phase: 'build' }));
  assert(!evaluateRule(rule, { riskTier: 'high', phase: 'review' }));
});

test('11. evaluateRule — OR logic', () => {
  const rule = { logic: 'or', conditions: [
    { field: 'riskTier', op: 'eq', value: 'high' },
    { field: 'riskTier', op: 'eq', value: 'critical' },
  ]};
  assert(evaluateRule(rule, { riskTier: 'critical' }));
  assert(!evaluateRule(rule, { riskTier: 'low' }));
});

test('12. evaluatePolicy — first match wins', () => {
  const policy = { rules: [
    { id: 'r1', conditions: [{ field: 'a', op: 'eq', value: 1 }], effect: 'permit' },
    { id: 'r2', conditions: [{ field: 'b', op: 'eq', value: 2 }], effect: 'deny' },
  ], defaultEffect: 'deny' };
  const result = evaluatePolicy(policy, { a: 1, b: 2 });
  assert(result.effect === 'permit');
  assert(result.matchedRules.includes('r1'));
});

test('13. evaluatePolicy — fallback to defaultEffect', () => {
  const policy = { rules: [
    { id: 'r1', conditions: [{ field: 'a', op: 'eq', value: 99 }], effect: 'permit' },
  ], defaultEffect: 'deny' };
  const result = evaluatePolicy(policy, { a: 1 });
  assert(result.effect === 'deny');
  assert(result.matchedRules.length === 0);
});

// ── Section 3: compileToAST ──

test('14. compileToAST — produces RuleNodes sorted by priority', () => {
  const ast = compileToAST(sampleRules);
  assert(ast.$schema === 'PolicyAST/1.0');
  assert(ast.rules.length === 2, `Expected 2 (disabled excluded), got ${ast.rules.length}`);
  assert(ast.rules[0].id === 'rule-high-risk', 'Highest priority first');
  assert(ast.rules[1].id === 'rule-auth-files');
});

test('15. compileToAST — disabled rules excluded', () => {
  const ast = compileToAST(sampleRules);
  const ids = ast.rules.map(r => r.id);
  assert(!ids.includes('rule-disabled'));
});

test('16. compileToAST — RuleNode has correct shape', () => {
  const ast = compileToAST(sampleRules);
  const rule = ast.rules[0];
  assert(rule.type === 'RuleNode');
  assert(typeof rule.priority === 'number');
  assert(rule.when);
  assert(Array.isArray(rule.effects));
  assert(typeof rule.hash === 'string');
  assert(typeof rule.version === 'number');
});

test('17. compileToAST — LeafNode from simple condition', () => {
  const ast = compileToAST(sampleRules);
  const when = ast.rules[0].when;
  assert(when.type === 'LeafNode');
  assert(when.field === 'riskTier');
  assert(when.op === 'eq');
  assert(when.value === 'high');
});

test('18. compileToAST — LogicalNode from AND condition', () => {
  const ast = compileToAST(sampleRules);
  const when = ast.rules[1].when;
  assert(when.type === 'LogicalNode');
  assert(when.operator === 'AND');
  assert(when.children.length === 2);
  assert(when.children[0].type === 'LeafNode');
});

test('19. compileToAST — EffectNode with group and merge strategy', () => {
  const ast = compileToAST(sampleRules);
  const effect = ast.rules[0].effects[0];
  assert(effect.type === 'EffectNode');
  assert(effect.effect === 'requireApprovals');
  assert(effect.group === 'approval');
  assert(effect.merge === 'max');
});

test('20. compileToAST — effectGroups collected', () => {
  const ast = compileToAST(sampleRules);
  assert(Array.isArray(ast.effectGroups));
  assert(ast.effectGroups.includes('approval'));
  assert(ast.effectGroups.includes('sandbox'));
});

test('21. compileToAST — rulesHash and astHash are sha256', () => {
  const ast = compileToAST(sampleRules);
  assert(ast.rulesHash.startsWith('sha256:'));
  assert(ast.astHash.startsWith('sha256:'));
});

test('22. compileToAST — deterministic tiebreak (same priority → id ASC)', () => {
  const rules = makeRules([
    { id: 'b-rule', priority: 50, when: { field: 'a', op: 'eq', value: 1 }, then: [{ effect: 'deny' }] },
    { id: 'a-rule', priority: 50, when: { field: 'b', op: 'eq', value: 2 }, then: [{ effect: 'allow' }] },
  ]);
  const ast = compileToAST(rules);
  assert(ast.rules[0].id === 'a-rule', 'alphabetical tiebreak');
  assert(ast.rules[1].id === 'b-rule');
});

// ── Section 4: walkCondition ──

test('23. walkCondition — LeafNode match', () => {
  const leaf = { type: 'LeafNode', field: 'riskTier', op: 'eq', value: 'high' };
  assert(walkCondition(leaf, { riskTier: 'high' }));
  assert(!walkCondition(leaf, { riskTier: 'low' }));
});

test('24. walkCondition — _always field', () => {
  const always = { type: 'LeafNode', field: '_always', op: 'exists', value: true };
  assert(walkCondition(always, {}));
});

test('25. walkCondition — LogicalNode AND', () => {
  const and = {
    type: 'LogicalNode', operator: 'AND', shortCircuit: true,
    children: [
      { type: 'LeafNode', field: 'a', op: 'eq', value: 1 },
      { type: 'LeafNode', field: 'b', op: 'eq', value: 2 },
    ],
  };
  assert(walkCondition(and, { a: 1, b: 2 }));
  assert(!walkCondition(and, { a: 1, b: 999 }));
});

test('26. walkCondition — LogicalNode OR', () => {
  const or = {
    type: 'LogicalNode', operator: 'OR', children: [
      { type: 'LeafNode', field: 'a', op: 'eq', value: 1 },
      { type: 'LeafNode', field: 'b', op: 'eq', value: 2 },
    ],
  };
  assert(walkCondition(or, { a: 99, b: 2 }));
  assert(!walkCondition(or, { a: 99, b: 99 }));
});

test('27. walkCondition — LogicalNode NOT', () => {
  const not = {
    type: 'LogicalNode', operator: 'NOT',
    children: [{ type: 'LeafNode', field: 'a', op: 'eq', value: 1 }],
  };
  assert(walkCondition(not, { a: 99 }));
  assert(!walkCondition(not, { a: 1 }));
});

test('28. walkCondition — dotted field path', () => {
  const leaf = { type: 'LeafNode', field: 'user.role', op: 'eq', value: 'admin' };
  assert(walkCondition(leaf, { user: { role: 'admin' } }));
  assert(!walkCondition(leaf, { user: { role: 'guest' } }));
});

test('29. walkCondition — null node returns true', () => {
  assert(walkCondition(null, {}));
});

// ── Section 5: compileAndSave + persistence ──

test('30. compileAndSave — writes AST and version to disk', () => {
  writeFileSync(join(testRoot, '.ogu/policies/rules.json'), JSON.stringify(sampleRules, null, 2));
  // Monkey-patch repoRoot for this scope
  const originalEnv = process.env.OGU_ROOT;
  process.env.OGU_ROOT = testRoot;
  try {
    const result = compileAndSave(testRoot);
    assert(!result.error, result.error);
    assert(result.ast);
    assert(result.version.version === 1);
    assert(existsSync(join(testRoot, '.ogu/policy/policy.ast.json')));
    assert(existsSync(join(testRoot, '.ogu/policy/policy-version.json')));
  } finally {
    process.env.OGU_ROOT = originalEnv;
  }
});

test('31. loadCompiledAST — reads saved AST', () => {
  const ast = loadCompiledAST(testRoot);
  assert(ast);
  assert(ast.$schema === 'PolicyAST/1.0');
  assert(ast.rules.length === 2);
});

test('32. loadPolicyVersion — reads version chain', () => {
  const version = loadPolicyVersion(testRoot);
  assert(version.current);
  assert(version.current.version === 1);
});

test('33. verifyASTFreshness — fresh when matching', () => {
  const result = verifyASTFreshness(testRoot);
  assert(result.fresh === true);
});

test('34. verifyASTFreshness — stale when rules changed', () => {
  const modified = { ...sampleRules, rules: [...sampleRules.rules, { id: 'new-rule', priority: 10, when: { field: 'x', op: 'eq', value: 1 }, then: [{ effect: 'deny' }] }] };
  writeFileSync(join(testRoot, '.ogu/policies/rules.json'), JSON.stringify(modified, null, 2));
  const result = verifyASTFreshness(testRoot);
  assert(result.fresh === false);
  assert(result.error.includes('OGU3602'));
});

test('35. compileAndSave — second compile bumps version', () => {
  const result = compileAndSave(testRoot);
  assert(result.version.version === 2);
  const chain = loadPolicyVersion(testRoot);
  assert(chain.history.length >= 1);
});

// ── Section 6: freeze/unfreeze ──

test('36. freezePolicy — sets frozen flag', () => {
  freezePolicy(testRoot);
  assert(isPolicyFrozen(testRoot));
});

test('37. unfreezePolicy — clears frozen flag', () => {
  unfreezePolicy(testRoot);
  assert(!isPolicyFrozen(testRoot));
});

// ── Section 7: hashCanonical ──

test('38. hashCanonical — produces sha256 prefix', () => {
  const hash = hashCanonical({ a: 1 });
  assert(hash.startsWith('sha256:'));
});

test('39. hashCanonical — deterministic', () => {
  const h1 = hashCanonical({ x: 1, y: 2 });
  const h2 = hashCanonical({ x: 1, y: 2 });
  assert(h1 === h2);
});

// ── Cleanup ──

rmSync(testRoot, { recursive: true, force: true });

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
