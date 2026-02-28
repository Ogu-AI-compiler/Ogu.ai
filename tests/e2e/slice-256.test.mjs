import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 256 — Task Graph + Dependency Scheduler\x1b[0m\n');

console.log('\x1b[36m  Part 1: Task Graph\x1b[0m');
test('task-graph.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/task-graph.mjs'));
});

const { createTaskGraph } = await import('../../tools/ogu/commands/lib/task-graph.mjs');

test('add tasks and dependencies', () => {
  const g = createTaskGraph();
  g.addTask('a'); g.addTask('b'); g.addTask('c');
  g.addDependency('b', 'a');
  assert.deepEqual(g.getDependencies('b'), ['a']);
});

test('topological sort', () => {
  const g = createTaskGraph();
  g.addTask('a'); g.addTask('b'); g.addTask('c');
  g.addDependency('b', 'a');
  g.addDependency('c', 'b');
  const order = g.topoSort();
  assert.ok(order.indexOf('a') < order.indexOf('b'));
  assert.ok(order.indexOf('b') < order.indexOf('c'));
});

test('detect cycle', () => {
  const g = createTaskGraph();
  g.addTask('x'); g.addTask('y');
  g.addDependency('x', 'y');
  g.addDependency('y', 'x');
  assert.ok(g.hasCycle());
});

console.log('\n\x1b[36m  Part 2: Dependency Scheduler\x1b[0m');
test('dependency-scheduler.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/dependency-scheduler.mjs'));
});

const { createDependencyScheduler } = await import('../../tools/ogu/commands/lib/dependency-scheduler.mjs');

test('schedule returns ready tasks', () => {
  const ds = createDependencyScheduler();
  ds.addTask('a', []);
  ds.addTask('b', ['a']);
  const ready = ds.getReady();
  assert.deepEqual(ready, ['a']);
});

test('complete unblocks dependents', () => {
  const ds = createDependencyScheduler();
  ds.addTask('a', []);
  ds.addTask('b', ['a']);
  ds.complete('a');
  const ready = ds.getReady();
  assert.ok(ready.includes('b'));
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
