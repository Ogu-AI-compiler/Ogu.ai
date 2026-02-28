import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `policy-engine-test-${randomUUID().slice(0, 8)}`);

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, '.ogu/policies'), { recursive: true });
  mkdirSync(join(TMP, '.ogu/approvals'), { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

function writeRules(rules) {
  writeFileSync(join(TMP, '.ogu/policies/rules.json'), JSON.stringify(rules), 'utf8');
}

const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = TMP;

const { loadRules, evaluatePolicy } = await import('../commands/lib/policy-engine.mjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    setup();
    fn();
    teardown();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    teardown();
  }
}

console.log('\n  policy-engine.mjs\n');

// ── loadRules ──

test('loadRules returns null when no rules file', () => {
  const result = loadRules();
  assert.equal(result, null);
});

test('loadRules loads rules from disk', () => {
  writeRules({ version: 1, rules: [{ id: 'rule-1', name: 'test' }] });
  const result = loadRules();
  assert.equal(result.version, 1);
  assert.equal(result.rules.length, 1);
  assert.equal(result.rules[0].id, 'rule-1');
});

// ── evaluatePolicy (legacy path — no compiled AST) ──

test('evaluatePolicy: no rules → default ALLOW', () => {
  const result = evaluatePolicy({ _root: TMP, taskName: 'test-task' });
  assert.equal(result.decision, 'ALLOW');
  assert.ok(result.reason.includes('No policy'));
});

test('evaluatePolicy: empty rules → default ALLOW', () => {
  writeRules({ version: 1, rules: [] });
  const result = evaluatePolicy({ _root: TMP, taskName: 'test-task' });
  assert.equal(result.decision, 'ALLOW');
});

test('evaluatePolicy: disabled rules are skipped', () => {
  writeRules({
    version: 1,
    rules: [
      {
        id: 'r1',
        name: 'Deny all',
        enabled: false,
        priority: 100,
        when: { field: 'task.name', op: 'exists', value: true },
        then: [{ effect: 'deny', params: { reason: 'blocked' } }],
      },
    ],
  });
  const result = evaluatePolicy({ _root: TMP, taskName: 'test-task' });
  assert.equal(result.decision, 'ALLOW');
  assert.equal(result.matchedRules.length, 0);
});

test('evaluatePolicy: matching deny rule → DENY', () => {
  writeRules({
    version: 1,
    rules: [
      {
        id: 'deny-high-risk',
        name: 'Block high risk',
        enabled: true,
        priority: 100,
        when: { field: 'task.riskTier', op: 'eq', value: 'critical' },
        then: [{ effect: 'deny', params: { reason: 'High risk blocked' } }],
      },
    ],
  });
  const result = evaluatePolicy({ _root: TMP, riskTier: 'critical', taskName: 'deploy' });
  assert.equal(result.decision, 'DENY');
  assert.ok(result.reason.includes('High risk'));
  assert.equal(result.matchedRules.length, 1);
  assert.equal(result.matchedRules[0].id, 'deny-high-risk');
});

test('evaluatePolicy: non-matching deny rule → ALLOW', () => {
  writeRules({
    version: 1,
    rules: [
      {
        id: 'deny-high-risk',
        name: 'Block high risk',
        enabled: true,
        priority: 100,
        when: { field: 'task.riskTier', op: 'eq', value: 'critical' },
        then: [{ effect: 'deny', params: { reason: 'blocked' } }],
      },
    ],
  });
  const result = evaluatePolicy({ _root: TMP, riskTier: 'low', taskName: 'test' });
  assert.equal(result.decision, 'ALLOW');
});

test('evaluatePolicy: requireApprovals effect without approval → REQUIRES_APPROVAL', () => {
  writeRules({
    version: 1,
    rules: [
      {
        id: 'require-review',
        name: 'Require review',
        enabled: true,
        priority: 50,
        when: { field: 'task.riskTier', op: 'eq', value: 'high' },
        then: [{ effect: 'requireApprovals', params: { count: 2, fromRoles: ['tech-lead', 'security'] } }],
      },
    ],
  });
  const result = evaluatePolicy({ _root: TMP, riskTier: 'high', taskName: 'deploy', featureSlug: 'auth' });
  assert.equal(result.decision, 'REQUIRES_APPROVAL');
  assert.ok(result.reason.includes('2 approval'));
  assert.ok(result.reason.includes('tech-lead'));
});

test('evaluatePolicy: requireApprovals with existing approvals → ALLOW', () => {
  writeRules({
    version: 1,
    rules: [
      {
        id: 'require-review',
        name: 'Require review',
        enabled: true,
        priority: 50,
        when: { field: 'task.riskTier', op: 'eq', value: 'high' },
        then: [{ effect: 'requireApprovals', params: { count: 1, fromRoles: ['tech-lead'] } }],
      },
    ],
  });
  // Write approval file
  writeFileSync(join(TMP, '.ogu/approvals/auth-deploy.json'), JSON.stringify([
    { role: 'tech-lead', status: 'approved', approvedAt: new Date().toISOString() },
  ]), 'utf8');

  const result = evaluatePolicy({ _root: TMP, riskTier: 'high', taskName: 'deploy', featureSlug: 'auth' });
  assert.equal(result.decision, 'ALLOW');
});

test('evaluatePolicy: explicit allow effect → ALLOW', () => {
  writeRules({
    version: 1,
    rules: [
      {
        id: 'allow-low',
        name: 'Allow low risk',
        enabled: true,
        priority: 50,
        when: { field: 'task.riskTier', op: 'eq', value: 'low' },
        then: [{ effect: 'allow' }],
      },
    ],
  });
  const result = evaluatePolicy({ _root: TMP, riskTier: 'low', taskName: 'test' });
  assert.equal(result.decision, 'ALLOW');
  assert.ok(result.reason.includes('Allowed by rule'));
});

// ── Legacy condition evaluation ──

test('evaluatePolicy: eq operator', () => {
  writeRules({
    version: 1,
    rules: [{
      id: 'r1', name: 'test', enabled: true, priority: 50,
      when: { field: 'task.capability', op: 'eq', value: 'deploy' },
      then: [{ effect: 'deny', params: { reason: 'no deploy' } }],
    }],
  });
  const deny = evaluatePolicy({ _root: TMP, capability: 'deploy', taskName: 't' });
  assert.equal(deny.decision, 'DENY');
  const allow = evaluatePolicy({ _root: TMP, capability: 'code_generation', taskName: 't' });
  assert.equal(allow.decision, 'ALLOW');
});

test('evaluatePolicy: in operator', () => {
  writeRules({
    version: 1,
    rules: [{
      id: 'r1', name: 'test', enabled: true, priority: 50,
      when: { field: 'task.riskTier', op: 'in', value: ['high', 'critical'] },
      then: [{ effect: 'deny', params: { reason: 'risky' } }],
    }],
  });
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'high', taskName: 't' }).decision, 'DENY');
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'critical', taskName: 't' }).decision, 'DENY');
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'low', taskName: 't' }).decision, 'ALLOW');
});

test('evaluatePolicy: gt operator', () => {
  writeRules({
    version: 1,
    rules: [{
      id: 'r1', name: 'test', enabled: true, priority: 50,
      when: { field: 'task.estimatedCost', op: 'gt', value: 1.0 },
      then: [{ effect: 'deny', params: { reason: 'too expensive' } }],
    }],
  });
  assert.equal(evaluatePolicy({ _root: TMP, estimatedCost: 2.0, taskName: 't' }).decision, 'DENY');
  assert.equal(evaluatePolicy({ _root: TMP, estimatedCost: 0.5, taskName: 't' }).decision, 'ALLOW');
});

test('evaluatePolicy: AND condition', () => {
  writeRules({
    version: 1,
    rules: [{
      id: 'r1', name: 'test', enabled: true, priority: 50,
      when: {
        operator: 'AND',
        conditions: [
          { field: 'task.riskTier', op: 'eq', value: 'high' },
          { field: 'task.estimatedCost', op: 'gt', value: 0.5 },
        ],
      },
      then: [{ effect: 'deny', params: { reason: 'risky and expensive' } }],
    }],
  });
  // Both conditions met
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'high', estimatedCost: 1.0, taskName: 't' }).decision, 'DENY');
  // Only one condition met
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'high', estimatedCost: 0.1, taskName: 't' }).decision, 'ALLOW');
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'low', estimatedCost: 1.0, taskName: 't' }).decision, 'ALLOW');
});

test('evaluatePolicy: OR condition', () => {
  writeRules({
    version: 1,
    rules: [{
      id: 'r1', name: 'test', enabled: true, priority: 50,
      when: {
        operator: 'OR',
        conditions: [
          { field: 'task.riskTier', op: 'eq', value: 'critical' },
          { field: 'budget.exceeded', op: 'eq', value: true },
        ],
      },
      then: [{ effect: 'deny', params: { reason: 'blocked' } }],
    }],
  });
  // First condition met
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'critical', taskName: 't' }).decision, 'DENY');
  // Second condition met
  assert.equal(evaluatePolicy({ _root: TMP, budgetExceeded: true, taskName: 't' }).decision, 'DENY');
  // Neither met
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'low', taskName: 't' }).decision, 'ALLOW');
});

test('evaluatePolicy: NOT condition', () => {
  writeRules({
    version: 1,
    rules: [{
      id: 'r1', name: 'test', enabled: true, priority: 50,
      when: {
        operator: 'NOT',
        conditions: [
          { field: 'task.riskTier', op: 'eq', value: 'low' },
        ],
      },
      then: [{ effect: 'deny', params: { reason: 'only low risk allowed' } }],
    }],
  });
  // NOT low → deny
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'high', taskName: 't' }).decision, 'DENY');
  // IS low → NOT doesn't fire → allow
  assert.equal(evaluatePolicy({ _root: TMP, riskTier: 'low', taskName: 't' }).decision, 'ALLOW');
});

test('evaluatePolicy: priority ordering (higher priority wins)', () => {
  writeRules({
    version: 1,
    rules: [
      {
        id: 'low-priority-allow',
        name: 'allow',
        enabled: true,
        priority: 10,
        when: { field: 'task.riskTier', op: 'eq', value: 'high' },
        then: [{ effect: 'allow' }],
      },
      {
        id: 'high-priority-deny',
        name: 'deny',
        enabled: true,
        priority: 90,
        when: { field: 'task.riskTier', op: 'eq', value: 'high' },
        then: [{ effect: 'deny', params: { reason: 'high priority wins' } }],
      },
    ],
  });
  const result = evaluatePolicy({ _root: TMP, riskTier: 'high', taskName: 't' });
  // Deny has higher priority, both match, but deny takes precedence
  assert.equal(result.decision, 'DENY');
});

test('evaluatePolicy: non-blocking effects only → ALLOW', () => {
  writeRules({
    version: 1,
    rules: [{
      id: 'r1', name: 'log', enabled: true, priority: 50,
      when: { field: 'task.riskTier', op: 'eq', value: 'medium' },
      then: [{ effect: 'log', params: { message: 'medium risk task' } }],
    }],
  });
  const result = evaluatePolicy({ _root: TMP, riskTier: 'medium', taskName: 't' });
  assert.equal(result.decision, 'ALLOW');
  assert.ok(result.reason.includes('Non-blocking'));
  assert.equal(result.matchedRules.length, 1);
});

// Cleanup
if (origRoot === undefined) delete process.env.OGU_ROOT;
else process.env.OGU_ROOT = origRoot;

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
