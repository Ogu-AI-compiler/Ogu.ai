import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 259 — Saga Orchestrator\x1b[0m\n');

console.log('\x1b[36m  Part 1: Saga Orchestrator\x1b[0m');
test('saga-orchestrator.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/saga-orchestrator.mjs'));
});

const { createSagaOrchestrator } = await import('../../tools/ogu/commands/lib/saga-orchestrator.mjs');

test('execute all steps in order', () => {
  const saga = createSagaOrchestrator();
  const log = [];
  saga.addStep({ execute: () => log.push('s1'), compensate: () => log.push('c1') });
  saga.addStep({ execute: () => log.push('s2'), compensate: () => log.push('c2') });
  saga.run();
  assert.deepEqual(log, ['s1', 's2']);
});

test('compensate on failure', () => {
  const saga = createSagaOrchestrator();
  const log = [];
  saga.addStep({ execute: () => log.push('s1'), compensate: () => log.push('c1') });
  saga.addStep({ execute: () => { log.push('s2'); throw new Error('fail'); }, compensate: () => log.push('c2') });
  saga.run();
  assert.ok(log.includes('c1'));
});

test('getStatus reports result', () => {
  const saga = createSagaOrchestrator();
  saga.addStep({ execute: () => {}, compensate: () => {} });
  saga.run();
  assert.equal(saga.getStatus(), 'completed');
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
