import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 327 — Event Store Advanced + Projection Engine\x1b[0m\n');
console.log('\x1b[36m  Part 1: Event Store Advanced\x1b[0m');
test('event-store-advanced.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/event-store-advanced.mjs')));
const { createEventStoreAdvanced } = await import('../../tools/ogu/commands/lib/event-store-advanced.mjs');
test('append events', () => { const es = createEventStoreAdvanced(); es.append('users', { type: 'created', name: 'alice' }); assert.equal(es.count(), 1); });
test('get stream', () => { const es = createEventStoreAdvanced(); es.append('users', { type: 'a' }); es.append('orders', { type: 'b' }); assert.equal(es.getStream('users').length, 1); });
test('get after seq', () => { const es = createEventStoreAdvanced(); es.append('s', { n: 1 }); es.append('s', { n: 2 }); es.append('s', { n: 3 }); assert.equal(es.getAfter(0).length, 2); });
test('list streams', () => { const es = createEventStoreAdvanced(); es.append('a', {}); es.append('b', {}); assert.deepEqual(es.listStreams(), ['a', 'b']); });

console.log('\n\x1b[36m  Part 2: Projection Engine\x1b[0m');
test('projection-engine.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/projection-engine.mjs')));
const { createProjectionEngine } = await import('../../tools/ogu/commands/lib/projection-engine.mjs');
test('define and apply', () => { const pe = createProjectionEngine(); pe.define('counter', { count: 0 }, (state, e) => ({ count: state.count + e.value })); pe.apply('counter', { value: 5 }); pe.apply('counter', { value: 3 }); assert.equal(pe.getState('counter').count, 8); });
test('applyAll', () => { const pe = createProjectionEngine(); pe.define('sum', { total: 0 }, (s, e) => ({ total: s.total + e.n })); pe.applyAll('sum', [{ n: 1 }, { n: 2 }, { n: 3 }]); assert.equal(pe.getState('sum').total, 6); });
test('list projections', () => { const pe = createProjectionEngine(); pe.define('a', {}, (s) => s); pe.define('b', {}, (s) => s); assert.deepEqual(pe.list(), ['a', 'b']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
