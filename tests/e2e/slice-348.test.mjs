import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 348 — Archive Builder + Archive Extractor\x1b[0m\n');
console.log('\x1b[36m  Part 1: Archive Builder\x1b[0m');
test('archive-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/archive-builder.mjs')));
const { createArchiveBuilder } = await import('../../tools/ogu/commands/lib/archive-builder.mjs');
test('add files and build', () => { const ab = createArchiveBuilder('test.tar'); ab.addFile('a.txt', 'hello'); ab.addFile('b.txt', 'world'); const arc = ab.build(); assert.equal(arc.metadata.fileCount, 2); assert.equal(arc.files['a.txt'], 'hello'); });
test('remove file', () => { const ab = createArchiveBuilder('t'); ab.addFile('x', 'y'); ab.removeFile('x'); assert.equal(ab.listFiles().length, 0); });
test('get size', () => { const ab = createArchiveBuilder('t'); ab.addFile('a', 'hello'); assert.equal(ab.getSize(), 5); });

console.log('\n\x1b[36m  Part 2: Archive Extractor\x1b[0m');
test('archive-extractor.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/archive-extractor.mjs')));
const { extractArchive, getFileFromArchive, listArchiveFiles } = await import('../../tools/ogu/commands/lib/archive-extractor.mjs');
const archive = { metadata: { name: 'test' }, files: { 'a.txt': 'hi', 'b.txt': 'bye' } };
test('extract archive', () => { const r = extractArchive(archive); assert.equal(r.files.length, 2); });
test('get file from archive', () => { assert.equal(getFileFromArchive(archive, 'a.txt'), 'hi'); });
test('list archive files', () => { assert.deepEqual(listArchiveFiles(archive), ['a.txt', 'b.txt']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
