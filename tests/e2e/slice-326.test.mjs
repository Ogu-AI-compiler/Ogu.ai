import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 326 — Command Bus + Query Bus\x1b[0m\n');
console.log('\x1b[36m  Part 1: Command Bus\x1b[0m');
test('command-bus.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/command-bus.mjs')));
const { createCommandBus } = await import('../../tools/ogu/commands/lib/command-bus.mjs');
test('register and dispatch', () => { const cb = createCommandBus(); cb.register('CREATE_USER', p => ({ id: 1, ...p })); const r = cb.dispatch('CREATE_USER', { name: 'alice' }); assert.equal(r.name, 'alice'); });
test('unknown command throws', () => { const cb = createCommandBus(); assert.throws(() => cb.dispatch('UNKNOWN', {})); });
test('middleware', () => { const cb = createCommandBus(); cb.use(ctx => ({ ...ctx, payload: { ...ctx.payload, enriched: true } })); cb.register('CMD', p => p); const r = cb.dispatch('CMD', { x: 1 }); assert.ok(r.enriched); });
test('list commands', () => { const cb = createCommandBus(); cb.register('A', () => {}); cb.register('B', () => {}); assert.deepEqual(cb.listCommands(), ['A', 'B']); });

console.log('\n\x1b[36m  Part 2: Query Bus\x1b[0m');
test('query-bus.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/query-bus.mjs')));
const { createQueryBus } = await import('../../tools/ogu/commands/lib/query-bus.mjs');
test('register and execute', () => { const qb = createQueryBus(); qb.register('GET_USER', p => ({ id: p.id, name: 'alice' })); const r = qb.execute('GET_USER', { id: 1 }); assert.equal(r.name, 'alice'); });
test('unknown query throws', () => { const qb = createQueryBus(); assert.throws(() => qb.execute('UNKNOWN')); });
test('list queries', () => { const qb = createQueryBus(); qb.register('Q1', () => {}); qb.register('Q2', () => {}); assert.deepEqual(qb.listQueries(), ['Q1', 'Q2']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
