import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 248 — Interrupt Controller + Exception Handler\x1b[0m\n');

console.log('\x1b[36m  Part 1: Interrupt Controller\x1b[0m');
test('interrupt-controller.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/interrupt-controller.mjs'));
});

const { createInterruptController } = await import('../../tools/ogu/commands/lib/interrupt-controller.mjs');

test('register and trigger interrupt', () => {
  const ic = createInterruptController();
  let called = false;
  ic.register(1, () => { called = true; });
  ic.trigger(1);
  assert.ok(called);
});

test('mask disables interrupt', () => {
  const ic = createInterruptController();
  let count = 0;
  ic.register(2, () => { count++; });
  ic.mask(2);
  ic.trigger(2);
  assert.equal(count, 0);
});

test('unmask re-enables interrupt', () => {
  const ic = createInterruptController();
  let count = 0;
  ic.register(3, () => { count++; });
  ic.mask(3);
  ic.unmask(3);
  ic.trigger(3);
  assert.equal(count, 1);
});

console.log('\n\x1b[36m  Part 2: Exception Handler\x1b[0m');
test('exception-handler.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/exception-handler.mjs'));
});

const { createExceptionHandler } = await import('../../tools/ogu/commands/lib/exception-handler.mjs');

test('handle catches exception', () => {
  const eh = createExceptionHandler();
  let caught = null;
  eh.register('DIVIDE_BY_ZERO', (e) => { caught = e; });
  eh.raise('DIVIDE_BY_ZERO', { detail: 'x/0' });
  assert.deepEqual(caught, { detail: 'x/0' });
});

test('unhandled exception tracked', () => {
  const eh = createExceptionHandler();
  eh.raise('UNKNOWN', {});
  const log = eh.getLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].type, 'UNKNOWN');
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
