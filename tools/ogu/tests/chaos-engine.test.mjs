/**
 * Chaos Engine Tests — plans, injections, verification, legacy compat.
 *
 * Run: node tools/ogu/tests/chaos-engine.test.mjs
 */

import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
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
  CHAOS_SCENARIOS, INJECTOR_TYPES, createChaosEngine,
  generateChaosPlan, loadChaosPlan, injectFault,
  runChaosPlan, listChaosPlans,
} = await import('../commands/lib/chaos-engine.mjs');

// ── Setup ──

const testRoot = join(tmpdir(), `ogu-chaos-test-${randomUUID().slice(0, 8)}`);
mkdirSync(join(testRoot, '.ogu/chaos'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/audit'), { recursive: true });
writeFileSync(join(testRoot, '.ogu/audit/current.jsonl'), '');

const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = testRoot;

console.log('\nChaos Engine Tests\n');

// ── Section 1: Constants ──

test('1. CHAOS_SCENARIOS — has standard scenarios', () => {
  assert(Array.isArray(CHAOS_SCENARIOS));
  assert(CHAOS_SCENARIOS.includes('budget_exhaustion'));
  assert(CHAOS_SCENARIOS.includes('task_crash'));
  assert(CHAOS_SCENARIOS.includes('secret_leak_attempt'));
});

test('2. INJECTOR_TYPES — has 8 injection types', () => {
  assert(Array.isArray(INJECTOR_TYPES));
  assert(INJECTOR_TYPES.length === 8);
  assert(INJECTOR_TYPES.includes('agent_failure'));
  assert(INJECTOR_TYPES.includes('budget_exhaustion'));
  assert(INJECTOR_TYPES.includes('policy_conflict'));
  assert(INJECTOR_TYPES.includes('blast_radius_violation'));
  assert(INJECTOR_TYPES.includes('model_unavailable'));
  assert(INJECTOR_TYPES.includes('concurrent_overload'));
  assert(INJECTOR_TYPES.includes('secret_leak_attempt'));
  assert(INJECTOR_TYPES.includes('session_expiry'));
});

// ── Section 2: Legacy createChaosEngine ──

test('3. createChaosEngine — creates engine with API', () => {
  const engine = createChaosEngine();
  assert(typeof engine.injectFailure === 'function');
  assert(typeof engine.clearFailures === 'function');
  assert(typeof engine.getActiveFailures === 'function');
  assert(typeof engine.simulateScenario === 'function');
  assert(typeof engine.getReport === 'function');
});

test('4. injectFailure — adds to active failures', () => {
  const engine = createChaosEngine();
  engine.injectFailure({ target: 'budget', type: 'exhaust', duration: 0 });
  assert(engine.getActiveFailures().length === 1);
  assert(engine.getActiveFailures()[0].target === 'budget');
});

test('5. clearFailures — removes all active', () => {
  const engine = createChaosEngine();
  engine.injectFailure({ target: 'a', type: 'x' });
  engine.injectFailure({ target: 'b', type: 'y' });
  assert(engine.getActiveFailures().length === 2);
  engine.clearFailures();
  assert(engine.getActiveFailures().length === 0);
});

test('6. simulateScenario — injects predefined injections', () => {
  const engine = createChaosEngine();
  const result = engine.simulateScenario('budget_exhaustion');
  assert(result.scenario === 'budget_exhaustion');
  assert(result.injected >= 1);
  assert(engine.getActiveFailures().length >= 1);
});

test('7. simulateScenario — unknown scenario injects nothing', () => {
  const engine = createChaosEngine();
  const result = engine.simulateScenario('nonexistent');
  assert(result.injected === 0);
});

test('8. getReport — includes stats', () => {
  const engine = createChaosEngine();
  engine.injectFailure({ target: 'a', type: 'x' });
  engine.injectFailure({ target: 'b', type: 'y' });
  const report = engine.getReport();
  assert(report.totalInjected === 2);
  assert(report.activeCount === 2);
  assert(report.timestamp);
});

// ── Section 3: generateChaosPlan ──

let planId;

test('9. generateChaosPlan — creates plan with 6 injections', () => {
  const plan = generateChaosPlan(testRoot, 'test-feature');
  assert(plan.planId);
  assert(plan.$schema === 'ChaosTest/1.0');
  assert(plan.targetFeature === 'test-feature');
  assert(plan.injections.length === 6);
  planId = plan.planId;
});

test('10. generateChaosPlan — writes plan to disk', () => {
  assert(existsSync(join(testRoot, '.ogu/chaos', `${planId}.json`)));
});

test('11. generateChaosPlan — each injection has expected fields', () => {
  const plan = loadChaosPlan(testRoot, planId);
  for (const inj of plan.injections) {
    assert(inj.id, 'injection has id');
    assert(inj.type, 'injection has type');
    assert(inj.params, 'injection has params');
    assert(inj.expected, 'injection has expected');
  }
});

// ── Section 4: loadChaosPlan ──

test('12. loadChaosPlan — loads from disk', () => {
  const plan = loadChaosPlan(testRoot, planId);
  assert(plan);
  assert(plan.planId === planId);
  assert(plan.targetFeature === 'test-feature');
});

test('13. loadChaosPlan — returns null for missing', () => {
  assert(loadChaosPlan(testRoot, 'no-such-plan') === null);
});

// ── Section 5: injectFault ──

test('14. injectFault — rejects unknown type', () => {
  const result = injectFault(testRoot, 'unknown_type', {}, 'feat');
  assert(result.status === 'error');
  assert(result.error.includes('Unknown'));
});

test('15. injectFault — agent_failure returns result', () => {
  const result = injectFault(testRoot, 'agent_failure', { failureMode: 'crash' }, 'test-feature');
  assert(result.status === 'completed');
  assert(result.type === 'agent_failure');
  assert(result.results);
  assert(result.timestamp);
});

test('16. injectFault — model_unavailable returns result', () => {
  const result = injectFault(testRoot, 'model_unavailable', {}, 'test-feature');
  assert(result.status === 'completed');
  assert(result.type === 'model_unavailable');
});

test('17. injectFault — concurrent_overload returns result', () => {
  const result = injectFault(testRoot, 'concurrent_overload', { simultaneousTasks: 3, targetResource: 'model_call' }, 'test-feature');
  assert(result.status === 'completed');
  assert(result.type === 'concurrent_overload');
});

test('18. injectFault — session_expiry returns result', () => {
  const result = injectFault(testRoot, 'session_expiry', { forceExpire: true }, 'test-feature');
  assert(result.status === 'completed');
  assert(result.type === 'session_expiry');
});

// ── Section 6: runChaosPlan ──

test('19. runChaosPlan — executes all injections in plan', () => {
  const report = runChaosPlan(testRoot, planId);
  assert(report.planId === planId);
  assert(report.targetFeature === 'test-feature');
  assert(report.results.length === 6);
  assert(report.summary.total === 6);
  assert(typeof report.summary.passed === 'number');
  assert(typeof report.summary.failed === 'number');
  assert(report.summary.passed + report.summary.failed === 6);
});

test('20. runChaosPlan — writes report to disk', () => {
  assert(existsSync(join(testRoot, '.ogu/chaos', `${planId}-report.json`)));
});

test('21. runChaosPlan — returns error for missing plan', () => {
  const result = runChaosPlan(testRoot, 'no-such-plan');
  assert(result.error);
});

// ── Section 7: listChaosPlans ──

test('22. listChaosPlans — lists plans and reports', () => {
  const list = listChaosPlans(testRoot);
  assert(list.plans.length >= 1);
  assert(list.reports.length >= 1);
});

test('23. listChaosPlans — empty dir returns empty', () => {
  const emptyRoot = join(tmpdir(), `ogu-chaos-empty-${randomUUID().slice(0, 4)}`);
  mkdirSync(join(emptyRoot, '.ogu/chaos'), { recursive: true });
  process.env.OGU_ROOT = emptyRoot;
  const list = listChaosPlans(emptyRoot);
  assert(list.plans.length === 0);
  assert(list.reports.length === 0);
  rmSync(emptyRoot, { recursive: true, force: true });
  process.env.OGU_ROOT = testRoot;
});

// ── Cleanup ──

process.env.OGU_ROOT = origRoot;
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
