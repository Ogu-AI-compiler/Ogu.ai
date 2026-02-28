import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 250 — Clock Divider + Timer Controller\x1b[0m\n');

console.log('\x1b[36m  Part 1: Clock Divider\x1b[0m');
test('clock-divider.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/clock-divider.mjs'));
});

const { createClockDivider } = await import('../../tools/ogu/commands/lib/clock-divider.mjs');

test('divides clock frequency', () => {
  const cd = createClockDivider({ inputFreq: 100, divisor: 4 });
  assert.equal(cd.getOutputFreq(), 25);
});

test('tick counts cycles', () => {
  const cd = createClockDivider({ inputFreq: 100, divisor: 2 });
  let outputs = 0;
  cd.onTick(() => outputs++);
  for (let i = 0; i < 6; i++) cd.tick();
  assert.equal(outputs, 3);
});

console.log('\n\x1b[36m  Part 2: Timer Controller\x1b[0m');
test('timer-controller.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/timer-controller.mjs'));
});

const { createTimerController } = await import('../../tools/ogu/commands/lib/timer-controller.mjs');

test('create and fire timer', () => {
  const tc = createTimerController();
  let fired = false;
  tc.createTimer('t1', 3, () => { fired = true; });
  tc.tick(); tc.tick(); tc.tick();
  assert.ok(fired);
});

test('cancel timer prevents fire', () => {
  const tc = createTimerController();
  let fired = false;
  tc.createTimer('t2', 3, () => { fired = true; });
  tc.cancel('t2');
  tc.tick(); tc.tick(); tc.tick();
  assert.ok(!fired);
});

test('list timers', () => {
  const tc = createTimerController();
  tc.createTimer('a', 5, () => {});
  tc.createTimer('b', 10, () => {});
  assert.equal(tc.list().length, 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
