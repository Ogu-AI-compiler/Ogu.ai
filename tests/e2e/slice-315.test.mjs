import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 315 — Data Masker + Anonymizer\x1b[0m\n');
console.log('\x1b[36m  Part 1: Data Masker\x1b[0m');
test('data-masker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/data-masker.mjs')));
const { createDataMasker } = await import('../../tools/ogu/commands/lib/data-masker.mjs');
test('mask sensitive fields', () => { const dm = createDataMasker(); dm.addField('password'); const r = dm.mask({ user: 'alice', password: 'secret' }); assert.equal(r.password, '******'); assert.equal(r.user, 'alice'); });
test('custom mask char', () => { const dm = createDataMasker(); dm.addField('ssn'); dm.setMaskChar('X'); const r = dm.mask({ ssn: '12345' }); assert.equal(r.ssn, 'XXXXX'); });
test('remove field', () => { const dm = createDataMasker(); dm.addField('x'); dm.removeField('x'); const r = dm.mask({ x: 'val' }); assert.equal(r.x, 'val'); });
test('list fields', () => { const dm = createDataMasker(); dm.addField('a'); dm.addField('b'); assert.deepEqual(dm.listFields(), ['a', 'b']); });

console.log('\n\x1b[36m  Part 2: Anonymizer\x1b[0m');
test('anonymizer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/anonymizer.mjs')));
const { createAnonymizer } = await import('../../tools/ogu/commands/lib/anonymizer.mjs');
test('consistent anonymization', () => { const anon = createAnonymizer(); const a1 = anon.anonymize('alice'); const a2 = anon.anonymize('alice'); assert.equal(a1, a2); });
test('different values get different anon IDs', () => { const anon = createAnonymizer(); const a = anon.anonymize('alice'); const b = anon.anonymize('bob'); assert.notEqual(a, b); });
test('deanonymize', () => { const anon = createAnonymizer(); const a = anon.anonymize('alice'); assert.equal(anon.deanonymize(a), 'alice'); });
test('anonymize object', () => { const anon = createAnonymizer(); const r = anon.anonymizeObject({ name: 'alice', age: 30 }, ['name']); assert.ok(r.name.startsWith('ANON_')); assert.equal(r.age, 30); });
test('reset clears mappings', () => { const anon = createAnonymizer(); anon.anonymize('x'); anon.reset(); assert.equal(anon.getMapping().size, 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
