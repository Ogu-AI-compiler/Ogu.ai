import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 262 — Event Emitter Advanced + Event Filter\x1b[0m\n');

console.log('\x1b[36m  Part 1: Event Emitter Advanced\x1b[0m');
test('event-emitter-advanced.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/event-emitter-advanced.mjs'));
});

const { createEventEmitterAdvanced } = await import('../../tools/ogu/commands/lib/event-emitter-advanced.mjs');

test('on and emit', () => {
  const ee = createEventEmitterAdvanced();
  let val = null;
  ee.on('test', (d) => { val = d; });
  ee.emit('test', 42);
  assert.equal(val, 42);
});

test('once fires only once', () => {
  const ee = createEventEmitterAdvanced();
  let count = 0;
  ee.once('ping', () => count++);
  ee.emit('ping'); ee.emit('ping');
  assert.equal(count, 1);
});

test('off removes listener', () => {
  const ee = createEventEmitterAdvanced();
  let count = 0;
  const fn = () => count++;
  ee.on('x', fn);
  ee.off('x', fn);
  ee.emit('x');
  assert.equal(count, 0);
});

console.log('\n\x1b[36m  Part 2: Event Filter\x1b[0m');
test('event-filter.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/event-filter.mjs'));
});

const { createEventFilter } = await import('../../tools/ogu/commands/lib/event-filter.mjs');

test('filter events by predicate', () => {
  const ef = createEventFilter();
  ef.addFilter('high', (e) => e.priority > 5);
  const events = [{ priority: 3 }, { priority: 8 }, { priority: 10 }];
  const filtered = ef.apply('high', events);
  assert.equal(filtered.length, 2);
});

test('chain filters', () => {
  const ef = createEventFilter();
  ef.addFilter('type', (e) => e.type === 'click');
  ef.addFilter('region', (e) => e.region === 'US');
  const events = [
    { type: 'click', region: 'US' },
    { type: 'click', region: 'EU' },
    { type: 'scroll', region: 'US' }
  ];
  const result = ef.applyAll(['type', 'region'], events);
  assert.equal(result.length, 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
