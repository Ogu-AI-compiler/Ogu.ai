import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 328 — Snapshot Manager + Snapshot Restore\x1b[0m\n');
console.log('\x1b[36m  Part 1: Snapshot Manager\x1b[0m');
test('snapshot-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/snapshot-manager.mjs')));
const { createSnapshotManager } = await import('../../tools/ogu/commands/lib/snapshot-manager.mjs');
test('take and restore', () => { const sm = createSnapshotManager(); const id = sm.take({ x: 42 }, 'test'); const s = sm.restore(id); assert.equal(s.x, 42); });
test('snapshot is deep copy', () => { const sm = createSnapshotManager(); const obj = { a: [1, 2] }; const id = sm.take(obj); obj.a.push(3); assert.equal(sm.restore(id).a.length, 2); });
test('list snapshots', () => { const sm = createSnapshotManager(); sm.take({ a: 1 }, 'first'); sm.take({ b: 2 }, 'second'); assert.equal(sm.list().length, 2); });
test('remove snapshot', () => { const sm = createSnapshotManager(); const id = sm.take({}); sm.remove(id); assert.equal(sm.list().length, 0); });
test('latest', () => { const sm = createSnapshotManager(); sm.take({ n: 1 }); sm.take({ n: 2 }); assert.equal(sm.latest().state.n, 2); });

console.log('\n\x1b[36m  Part 2: Snapshot Restore\x1b[0m');
test('snapshot-restore.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/snapshot-restore.mjs')));
const { createSnapshotRestore } = await import('../../tools/ogu/commands/lib/snapshot-restore.mjs');
test('restore to target', () => { const sr = createSnapshotRestore(); const target = { x: 0 }; sr.restore({ x: 42 }, target); assert.equal(target.x, 42); });
test('restore with validator', () => { const sr = createSnapshotRestore(s => s.version === 2); assert.throws(() => sr.restore({ version: 1 }, {})); });
test('restore history', () => { const sr = createSnapshotRestore(); sr.restore({ a: 1 }, {}); sr.restore({ b: 2 }, {}); assert.equal(sr.restoreCount(), 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
