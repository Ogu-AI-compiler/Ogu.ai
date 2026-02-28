import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 298 — String Alignment + Sequence Matcher\x1b[0m\n');
console.log('\x1b[36m  Part 1: String Alignment\x1b[0m');
test('string-alignment.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/string-alignment.mjs')));
const { needlemanWunsch } = await import('../../tools/ogu/commands/lib/string-alignment.mjs');
test('align two sequences', () => { const r = needlemanWunsch('GATTACA','GCATGCU'); assert.ok(r.score !== undefined); assert.ok(r.alignA.length > 0); });

console.log('\n\x1b[36m  Part 2: Sequence Matcher\x1b[0m');
test('sequence-matcher.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/sequence-matcher.mjs')));
const { createSequenceMatcher } = await import('../../tools/ogu/commands/lib/sequence-matcher.mjs');
test('similarity ratio', () => { const sm = createSequenceMatcher('hello','hallo'); assert.ok(sm.ratio() > 0.5); });
test('identical ratio is 1', () => { const sm = createSequenceMatcher('abc','abc'); assert.equal(sm.ratio(), 1); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
