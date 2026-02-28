/**
 * Plan Loader Tests — centralized Plan.json loading and validation.
 *
 * Run: node tools/ogu/tests/plan-loader.test.mjs
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

const { getPlanPath, loadPlan, getPlanTask, getPlanTasks, validatePlan } =
  await import('../commands/lib/plan-loader.mjs');

const testRoot = join(tmpdir(), `ogu-plan-test-${randomUUID().slice(0, 8)}`);

// Create test fixtures — both current and legacy vault paths
const currentDir = join(testRoot, 'docs/vault/features/auth');
const legacyDir = join(testRoot, 'docs/vault/04_Features/payments');
mkdirSync(currentDir, { recursive: true });
mkdirSync(legacyDir, { recursive: true });

const authPlan = {
  featureSlug: 'auth',
  tasks: [
    { id: 'task-1', name: 'Setup auth module', dependsOn: [] },
    { id: 'task-2', name: 'Add login endpoint', dependsOn: ['task-1'] },
    { id: 'task-3', title: 'Add logout endpoint', dependsOn: ['task-1'] },
  ],
};

const paymentsPlan = {
  featureSlug: 'payments',
  tasks: [
    { id: 'pay-1', name: 'Stripe integration' },
    { id: 'pay-2', name: 'Webhook handler', dependsOn: ['pay-1'] },
  ],
};

writeFileSync(join(currentDir, 'Plan.json'), JSON.stringify(authPlan, null, 2), 'utf8');
writeFileSync(join(legacyDir, 'Plan.json'), JSON.stringify(paymentsPlan, null, 2), 'utf8');

console.log('\nPlan Loader Tests\n');

// ── getPlanPath ──

test('1. getPlanPath finds Plan.json in current vault path', () => {
  const p = getPlanPath('auth', testRoot);
  assert(p !== null, 'Should find path');
  assert(p.includes('docs/vault/features/auth/Plan.json'), `Wrong path: ${p}`);
});

test('2. getPlanPath finds Plan.json in legacy vault path', () => {
  const p = getPlanPath('payments', testRoot);
  assert(p !== null, 'Should find path');
  assert(p.includes('docs/vault/04_Features/payments/Plan.json'), `Wrong path: ${p}`);
});

test('3. getPlanPath returns null for nonexistent slug', () => {
  const p = getPlanPath('nonexistent', testRoot);
  assert(p === null, 'Should return null');
});

// ── loadPlan ──

test('4. loadPlan loads and parses Plan.json', () => {
  const plan = loadPlan('auth', testRoot);
  assert(plan !== null, 'Should load plan');
  assert(plan.featureSlug === 'auth', 'Should have correct slug');
  assert(Array.isArray(plan.tasks), 'Should have tasks array');
  assert(plan.tasks.length === 3, `Expected 3 tasks, got ${plan.tasks.length}`);
});

test('5. loadPlan loads from legacy path', () => {
  const plan = loadPlan('payments', testRoot);
  assert(plan !== null, 'Should load plan');
  assert(plan.featureSlug === 'payments', 'Should have correct slug');
  assert(plan.tasks.length === 2, `Expected 2 tasks, got ${plan.tasks.length}`);
});

test('6. loadPlan returns null for nonexistent slug', () => {
  const plan = loadPlan('nonexistent', testRoot);
  assert(plan === null, 'Should return null');
});

test('7. loadPlan returns null for invalid JSON', () => {
  const badDir = join(testRoot, 'docs/vault/features/broken');
  mkdirSync(badDir, { recursive: true });
  writeFileSync(join(badDir, 'Plan.json'), '{ invalid json !!!', 'utf8');

  const plan = loadPlan('broken', testRoot);
  assert(plan === null, 'Should return null for invalid JSON');
});

// ── getPlanTask ──

test('8. getPlanTask finds task by ID', () => {
  const task = getPlanTask('auth', 'task-2', testRoot);
  assert(task !== null, 'Should find task');
  assert(task.id === 'task-2', 'Should have correct ID');
  assert(task.name === 'Add login endpoint', 'Should have correct name');
});

test('9. getPlanTask returns null for nonexistent task ID', () => {
  const task = getPlanTask('auth', 'task-999', testRoot);
  assert(task === null, 'Should return null');
});

test('10. getPlanTask returns null for nonexistent slug', () => {
  const task = getPlanTask('nonexistent', 'task-1', testRoot);
  assert(task === null, 'Should return null');
});

// ── getPlanTasks ──

test('11. getPlanTasks returns all tasks', () => {
  const tasks = getPlanTasks('auth', testRoot);
  assert(tasks.length === 3, `Expected 3 tasks, got ${tasks.length}`);
  assert(tasks[0].id === 'task-1', 'First task should be task-1');
});

test('12. getPlanTasks returns empty for nonexistent slug', () => {
  const tasks = getPlanTasks('nonexistent', testRoot);
  assert(tasks.length === 0, 'Should return empty array');
});

// ── validatePlan ──

test('13. validatePlan: valid plan passes', () => {
  const result = validatePlan(authPlan);
  assert(result.valid === true, `Should be valid, errors: ${result.errors.join(', ')}`);
  assert(result.errors.length === 0, 'Should have no errors');
});

test('14. validatePlan: null plan fails', () => {
  const result = validatePlan(null);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.length > 0, 'Should have errors');
  assert(result.errors[0].includes('null'), 'Should mention null');
});

test('15. validatePlan: missing tasks array fails', () => {
  const result = validatePlan({ featureSlug: 'test' });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('tasks')), 'Should mention tasks');
});

test('16. validatePlan: task missing id fails', () => {
  const result = validatePlan({ tasks: [{ name: 'No ID' }] });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('missing "id"')), 'Should mention missing id');
});

test('17. validatePlan: task missing name and title fails', () => {
  const result = validatePlan({ tasks: [{ id: 'test-1' }] });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('missing "name"')), 'Should mention missing name');
});

test('18. validatePlan: duplicate task IDs fail', () => {
  const result = validatePlan({
    tasks: [
      { id: 'dup-1', name: 'First' },
      { id: 'dup-1', name: 'Second' },
    ],
  });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Should mention duplicate');
});

test('19. validatePlan: task with title (not name) is valid', () => {
  const result = validatePlan({
    tasks: [{ id: 't-1', title: 'Title only' }],
  });
  assert(result.valid === true, 'Should be valid with title instead of name');
});

test('20. validatePlan: invalid dependency detected', () => {
  const result = validatePlan({
    tasks: [
      { id: 't-1', name: 'First', dependsOn: ['nonexistent'] },
    ],
  });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('nonexistent')), 'Should mention bad dependency');
});

// ── Cleanup ──

try { rmSync(testRoot, { recursive: true, force: true }); } catch { /* best effort */ }

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
