import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 260 — CQRS Handler + Event Projector\x1b[0m\n');

console.log('\x1b[36m  Part 1: CQRS Handler\x1b[0m');
test('cqrs-handler.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/cqrs-handler.mjs'));
});

const { createCQRSHandler } = await import('../../tools/ogu/commands/lib/cqrs-handler.mjs');

test('register and execute command', () => {
  const cqrs = createCQRSHandler();
  let result = null;
  cqrs.registerCommand('CREATE_USER', (data) => { result = data; });
  cqrs.executeCommand('CREATE_USER', { name: 'Alice' });
  assert.equal(result.name, 'Alice');
});

test('register and execute query', () => {
  const cqrs = createCQRSHandler();
  cqrs.registerQuery('GET_USERS', () => ['Alice', 'Bob']);
  const users = cqrs.executeQuery('GET_USERS');
  assert.deepEqual(users, ['Alice', 'Bob']);
});

test('unknown command throws', () => {
  const cqrs = createCQRSHandler();
  assert.throws(() => cqrs.executeCommand('NOPE', {}));
});

console.log('\n\x1b[36m  Part 2: Event Projector\x1b[0m');
test('event-projector.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/event-projector.mjs'));
});

const { createEventProjector } = await import('../../tools/ogu/commands/lib/event-projector.mjs');

test('project events to state', () => {
  const proj = createEventProjector({ count: 0 });
  proj.on('INCREMENT', (state) => ({ count: state.count + 1 }));
  proj.apply({ type: 'INCREMENT' });
  proj.apply({ type: 'INCREMENT' });
  assert.equal(proj.getState().count, 2);
});

test('getEvents returns history', () => {
  const proj = createEventProjector({ x: 0 });
  proj.on('SET', (state, e) => ({ x: e.value }));
  proj.apply({ type: 'SET', value: 42 });
  assert.equal(proj.getEvents().length, 1);
});

test('unhandled event preserves state', () => {
  const proj = createEventProjector({ v: 1 });
  proj.apply({ type: 'UNKNOWN' });
  assert.equal(proj.getState().v, 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
