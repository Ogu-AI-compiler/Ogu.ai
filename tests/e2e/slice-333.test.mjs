import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 333 — Search Index + Full Text Search\x1b[0m\n');
console.log('\x1b[36m  Part 1: Search Index\x1b[0m');
test('search-index.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/search-index.mjs')));
const { createSearchIndex } = await import('../../tools/ogu/commands/lib/search-index.mjs');
test('index and search', () => { const si = createSearchIndex(); si.add('d1', 'hello world'); si.add('d2', 'hello node'); const r = si.search('hello'); assert.ok(r.includes('d1') && r.includes('d2')); });
test('relevance ranking', () => { const si = createSearchIndex(); si.add('d1', 'hello hello hello'); si.add('d2', 'hello world'); const r = si.search('hello'); assert.equal(r[0], 'd1'); });
test('remove document', () => { const si = createSearchIndex(); si.add('d1', 'test'); si.remove('d1'); assert.equal(si.search('test').length, 0); });
test('count', () => { const si = createSearchIndex(); si.add('a', 'x'); si.add('b', 'y'); assert.equal(si.count(), 2); });

console.log('\n\x1b[36m  Part 2: Full Text Search\x1b[0m');
test('full-text-search.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/full-text-search.mjs')));
const { createFullTextSearch } = await import('../../tools/ogu/commands/lib/full-text-search.mjs');
test('search with score', () => { const fts = createFullTextSearch(); fts.addDocument('d1', 'The quick brown fox'); fts.addDocument('d2', 'The lazy dog'); const r = fts.search('quick fox'); assert.equal(r[0].id, 'd1'); assert.ok(r[0].score > 0); });
test('case insensitive', () => { const fts = createFullTextSearch(); fts.addDocument('d1', 'Hello World'); const r = fts.search('hello'); assert.equal(r.length, 1); });
test('no results', () => { const fts = createFullTextSearch(); fts.addDocument('d1', 'abc'); assert.equal(fts.search('xyz').length, 0); });
test('remove document', () => { const fts = createFullTextSearch(); fts.addDocument('d1', 'test'); fts.removeDocument('d1'); assert.equal(fts.search('test').length, 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
