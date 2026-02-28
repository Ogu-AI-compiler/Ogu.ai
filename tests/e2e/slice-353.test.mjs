import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 353 — CSV Parser + CSV Serializer\x1b[0m\n');
console.log('\x1b[36m  Part 1: CSV Parser\x1b[0m');
test('csv-parser.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/csv-parser.mjs')));
const { parseCSV } = await import('../../tools/ogu/commands/lib/csv-parser.mjs');
test('parse with headers', () => { const r = parseCSV('name,age\nalice,30\nbob,25'); assert.equal(r.rows.length, 2); assert.equal(r.rows[0].name, 'alice'); });
test('parse without headers', () => { const r = parseCSV('a,b\nc,d', { header: false }); assert.equal(r.rows.length, 2); assert.equal(r.headers, null); });
test('custom delimiter', () => { const r = parseCSV('a;b\n1;2', { delimiter: ';' }); assert.equal(r.rows[0].a, '1'); });

console.log('\n\x1b[36m  Part 2: CSV Serializer\x1b[0m');
test('csv-serializer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/csv-serializer.mjs')));
const { serializeCSV } = await import('../../tools/ogu/commands/lib/csv-serializer.mjs');
test('serialize objects', () => { const r = serializeCSV([{ name: 'alice', age: 30 }, { name: 'bob', age: 25 }]); assert.ok(r.includes('name,age')); assert.ok(r.includes('alice,30')); });
test('serialize arrays', () => { const r = serializeCSV([[1, 2], [3, 4]]); assert.equal(r, '1,2\n3,4'); });
test('empty input', () => { assert.equal(serializeCSV([]), ''); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
