import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 318 — Connection Pool Manager + Circuit State Machine\x1b[0m\n');
console.log('\x1b[36m  Part 1: Connection Pool Manager\x1b[0m');
test('connection-pool-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/connection-pool-manager.mjs')));
const { createConnectionPoolManager } = await import('../../tools/ogu/commands/lib/connection-pool-manager.mjs');
test('acquire connection', () => { const pool = createConnectionPoolManager(3, id => ({ id })); const c = pool.acquire(); assert.deepEqual(c, { id: 0 }); });
test('release and reuse', () => { const pool = createConnectionPoolManager(1, id => ({ id })); const c = pool.acquire(); pool.release(c); const c2 = pool.acquire(); assert.strictEqual(c, c2); });
test('pool exhaustion', () => { const pool = createConnectionPoolManager(1, id => ({ id })); pool.acquire(); assert.equal(pool.acquire(), null); });
test('stats tracking', () => { const pool = createConnectionPoolManager(3, id => ({ id })); pool.acquire(); pool.acquire(); const s = pool.getStats(); assert.equal(s.inUse, 2); assert.equal(s.available, 0); });

console.log('\n\x1b[36m  Part 2: Circuit State Machine\x1b[0m');
test('circuit-state-machine.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/circuit-state-machine.mjs')));
const { createCircuitStateMachine } = await import('../../tools/ogu/commands/lib/circuit-state-machine.mjs');
test('starts closed', () => { const cb = createCircuitStateMachine({ failureThreshold: 2 }); assert.equal(cb.getState(), 'CLOSED'); });
test('opens after failures', () => { const cb = createCircuitStateMachine({ failureThreshold: 2 }); try { cb.call(() => { throw new Error('fail'); }); } catch {}; try { cb.call(() => { throw new Error('fail'); }); } catch {}; assert.equal(cb.getState(), 'OPEN'); });
test('blocks when open', () => { const cb = createCircuitStateMachine({ failureThreshold: 1 }); try { cb.call(() => { throw new Error('fail'); }, 100); } catch {}; assert.throws(() => cb.call(() => 1, 200)); });
test('half-open after timeout', () => { const cb = createCircuitStateMachine({ failureThreshold: 1, resetTimeoutMs: 100 }); try { cb.call(() => { throw new Error('fail'); }, 100); } catch {}; const r = cb.call(() => 42, 250); assert.equal(r, 42); assert.equal(cb.getState(), 'CLOSED'); });
test('reset', () => { const cb = createCircuitStateMachine({ failureThreshold: 1 }); try { cb.call(() => { throw new Error('fail'); }); } catch {}; cb.reset(); assert.equal(cb.getState(), 'CLOSED'); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
