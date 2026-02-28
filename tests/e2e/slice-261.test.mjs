import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 261 — State Machine Builder + State Transition\x1b[0m\n');

console.log('\x1b[36m  Part 1: State Machine Builder\x1b[0m');
test('state-machine-builder.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/state-machine-builder.mjs'));
});

const { createStateMachineBuilder } = await import('../../tools/ogu/commands/lib/state-machine-builder.mjs');

test('build and transition', () => {
  const sm = createStateMachineBuilder()
    .addState('idle').addState('running').addState('done')
    .addTransition('idle', 'start', 'running')
    .addTransition('running', 'finish', 'done')
    .setInitial('idle')
    .build();
  assert.equal(sm.current(), 'idle');
  sm.send('start');
  assert.equal(sm.current(), 'running');
});

test('invalid transition stays', () => {
  const sm = createStateMachineBuilder()
    .addState('a').addState('b')
    .addTransition('a', 'go', 'b')
    .setInitial('a')
    .build();
  sm.send('invalid');
  assert.equal(sm.current(), 'a');
});

console.log('\n\x1b[36m  Part 2: State Transition\x1b[0m');
test('state-transition.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/state-transition.mjs'));
});

const { createStateTransition } = await import('../../tools/ogu/commands/lib/state-transition.mjs');

test('record and query transitions', () => {
  const st = createStateTransition();
  st.addRule('open', 'close', 'closed');
  st.addRule('closed', 'open', 'open');
  assert.equal(st.getNextState('open', 'close'), 'closed');
});

test('unknown returns null', () => {
  const st = createStateTransition();
  assert.equal(st.getNextState('x', 'y'), null);
});

test('listRules returns all', () => {
  const st = createStateTransition();
  st.addRule('a', 'b', 'c');
  assert.equal(st.listRules().length, 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
