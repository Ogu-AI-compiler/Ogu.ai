import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 313 — Shared Memory Buffer + Memory Pool\x1b[0m\n');
console.log('\x1b[36m  Part 1: Shared Memory Buffer\x1b[0m');
test('shared-memory-buffer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/shared-memory-buffer.mjs')));
const { createSharedMemoryBuffer } = await import('../../tools/ogu/commands/lib/shared-memory-buffer.mjs');
test('write and read', () => { const buf = createSharedMemoryBuffer(16); buf.write(0, 42); assert.equal(buf.read(0), 42); });
test('bounds check', () => { const buf = createSharedMemoryBuffer(4); assert.throws(() => buf.write(10, 1)); });
test('lock and unlock', () => { const buf = createSharedMemoryBuffer(8); assert.ok(buf.lock(0)); assert.ok(!buf.lock(0)); buf.unlock(0); assert.ok(buf.lock(0)); });
test('isLocked', () => { const buf = createSharedMemoryBuffer(4); buf.lock(2); assert.ok(buf.isLocked(2)); assert.ok(!buf.isLocked(1)); });
test('getSize', () => { const buf = createSharedMemoryBuffer(32); assert.equal(buf.getSize(), 32); });

console.log('\n\x1b[36m  Part 2: Memory Pool\x1b[0m');
test('memory-pool.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/memory-pool.mjs')));
const { createMemoryPool } = await import('../../tools/ogu/commands/lib/memory-pool.mjs');
test('allocate and write/read', () => { const pool = createMemoryPool(64, 4); const id = pool.allocate(); pool.write(id, 'data'); assert.equal(pool.read(id), 'data'); });
test('release block', () => { const pool = createMemoryPool(64, 2); const id = pool.allocate(); pool.release(id); const stats = pool.getStats(); assert.equal(stats.free, 2); });
test('pool exhaustion', () => { const pool = createMemoryPool(32, 1); pool.allocate(); assert.equal(pool.allocate(), null); });
test('stats tracking', () => { const pool = createMemoryPool(32, 4); pool.allocate(); pool.allocate(); const s = pool.getStats(); assert.equal(s.used, 2); assert.equal(s.free, 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
