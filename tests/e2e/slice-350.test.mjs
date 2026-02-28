import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 350 — Content Addressable Store + Blob Storage\x1b[0m\n');
console.log('\x1b[36m  Part 1: Content Addressable Store\x1b[0m');
test('content-addressable-store.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/content-addressable-store.mjs')));
const { simpleHash } = await import('../../tools/ogu/commands/lib/hash-digest.mjs');
const { createContentAddressableStore } = await import('../../tools/ogu/commands/lib/content-addressable-store.mjs');
test('put and get', () => { const cas = createContentAddressableStore(simpleHash); const h = cas.put('hello world'); assert.equal(cas.get(h), 'hello world'); });
test('deduplication', () => { const cas = createContentAddressableStore(simpleHash); cas.put('same'); cas.put('same'); assert.equal(cas.count(), 1); });
test('has check', () => { const cas = createContentAddressableStore(simpleHash); const h = cas.put('x'); assert.ok(cas.has(h)); assert.ok(!cas.has('nope')); });
test('remove', () => { const cas = createContentAddressableStore(simpleHash); const h = cas.put('x'); cas.remove(h); assert.ok(!cas.has(h)); });

console.log('\n\x1b[36m  Part 2: Blob Storage\x1b[0m');
test('blob-storage.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/blob-storage.mjs')));
const { createBlobStorage } = await import('../../tools/ogu/commands/lib/blob-storage.mjs');
test('put and get blob', () => { const bs = createBlobStorage(); bs.put('key1', 'data123', { type: 'text' }); assert.equal(bs.get('key1'), 'data123'); });
test('get metadata', () => { const bs = createBlobStorage(); bs.put('k', 'abc', { type: 'bin' }); const m = bs.getMetadata('k'); assert.equal(m.type, 'bin'); assert.equal(m.size, 3); });
test('list and total size', () => { const bs = createBlobStorage(); bs.put('a', 'xx'); bs.put('b', 'yyyy'); assert.equal(bs.list().length, 2); assert.equal(bs.totalSize(), 6); });
test('remove blob', () => { const bs = createBlobStorage(); bs.put('k', 'v'); bs.remove('k'); assert.equal(bs.get('k'), null); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
