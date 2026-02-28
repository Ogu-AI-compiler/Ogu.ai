import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 349 — Hash Digest + File Deduplicator\x1b[0m\n');
console.log('\x1b[36m  Part 1: Hash Digest\x1b[0m');
test('hash-digest.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/hash-digest.mjs')));
const { simpleHash, hashMultiple, verifyHash } = await import('../../tools/ogu/commands/lib/hash-digest.mjs');
test('deterministic hash', () => { assert.equal(simpleHash('hello'), simpleHash('hello')); });
test('different inputs differ', () => { assert.notEqual(simpleHash('a'), simpleHash('b')); });
test('hash multiple', () => { const r = hashMultiple(['a', 'b', 'c']); assert.equal(r.length, 3); });
test('verify hash', () => { const h = simpleHash('test'); assert.ok(verifyHash('test', h)); assert.ok(!verifyHash('other', h)); });

console.log('\n\x1b[36m  Part 2: File Deduplicator\x1b[0m');
test('file-deduplicator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/file-deduplicator.mjs')));
const { createFileDeduplicator } = await import('../../tools/ogu/commands/lib/file-deduplicator.mjs');
test('detect duplicates', () => { const fd = createFileDeduplicator(simpleHash); fd.add('/a.txt', 'same'); fd.add('/b.txt', 'same'); fd.add('/c.txt', 'different'); const dupes = fd.getDuplicates(); assert.equal(dupes.length, 1); assert.equal(dupes[0].paths.length, 2); });
test('total vs unique', () => { const fd = createFileDeduplicator(simpleHash); fd.add('/a', 'x'); fd.add('/b', 'x'); fd.add('/c', 'y'); assert.equal(fd.totalFiles(), 3); assert.equal(fd.uniqueCount(), 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
