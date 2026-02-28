import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 294 — Stopword Filter + Stemmer\x1b[0m\n');
console.log('\x1b[36m  Part 1: Stopword Filter\x1b[0m');
test('stopword-filter.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/stopword-filter.mjs')));
const { createStopwordFilter } = await import('../../tools/ogu/commands/lib/stopword-filter.mjs');
test('filter removes stopwords', () => { const sf = createStopwordFilter(['the','is','a']); assert.deepEqual(sf.filter(['the','cat','is','happy']), ['cat','happy']); });
test('addStopword extends list', () => { const sf = createStopwordFilter(['the']); sf.addStopword('cat'); assert.deepEqual(sf.filter(['the','cat','runs']), ['runs']); });

console.log('\n\x1b[36m  Part 2: Stemmer\x1b[0m');
test('stemmer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/stemmer.mjs')));
const { stem } = await import('../../tools/ogu/commands/lib/stemmer.mjs');
test('stem running->run', () => assert.equal(stem('running'), 'run'));
test('stem cats->cat', () => assert.equal(stem('cats'), 'cat'));
test('stem happily->happi', () => assert.equal(stem('happily'), 'happi'));

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
