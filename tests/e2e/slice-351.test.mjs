import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 351 — JSON Schema Builder + Schema Registry\x1b[0m\n');
console.log('\x1b[36m  Part 1: JSON Schema Builder\x1b[0m');
test('json-schema-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/json-schema-builder.mjs')));
const { createJsonSchemaBuilder } = await import('../../tools/ogu/commands/lib/json-schema-builder.mjs');
test('build schema', () => { const s = createJsonSchemaBuilder().string('name').number('age').required('name').build(); assert.equal(s.properties.name.type, 'string'); assert.ok(s.required.includes('name')); });
test('array property', () => { const s = createJsonSchemaBuilder().array('tags', { type: 'string' }).build(); assert.equal(s.properties.tags.type, 'array'); });
test('boolean property', () => { const s = createJsonSchemaBuilder().boolean('active').build(); assert.equal(s.properties.active.type, 'boolean'); });

console.log('\n\x1b[36m  Part 2: Schema Registry\x1b[0m');
test('schema-registry.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/schema-registry.mjs')));
const { createSchemaRegistry } = await import('../../tools/ogu/commands/lib/schema-registry.mjs');
test('register and get', () => { const sr = createSchemaRegistry(); sr.register('User', '1.0', { type: 'object' }); assert.deepEqual(sr.get('User', '1.0'), { type: 'object' }); });
test('get latest', () => { const sr = createSchemaRegistry(); sr.register('User', '1.0', { v: 1 }); sr.register('User', '2.0', { v: 2 }); assert.equal(sr.getLatest('User').v, 2); });
test('list schemas', () => { const sr = createSchemaRegistry(); sr.register('A', '1', {}); sr.register('B', '1', {}); assert.equal(sr.list().length, 2); });
test('has check', () => { const sr = createSchemaRegistry(); sr.register('X', '1', {}); assert.ok(sr.has('X', '1')); assert.ok(!sr.has('X', '2')); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
