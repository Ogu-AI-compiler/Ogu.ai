import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 266 — Schema Validator + Type Coercer\x1b[0m\n');

console.log('\x1b[36m  Part 1: Schema Validator\x1b[0m');
test('schema-validator.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/schema-validator.mjs'));
});

const { createSchemaValidator } = await import('../../tools/ogu/commands/lib/schema-validator.mjs');

test('validates matching schema', () => {
  const sv = createSchemaValidator({
    type: 'object',
    properties: { name: { type: 'string' }, age: { type: 'number' } }
  });
  const result = sv.validate({ name: 'Alice', age: 30 });
  assert.ok(result.valid);
});

test('rejects invalid type', () => {
  const sv = createSchemaValidator({
    type: 'object',
    properties: { name: { type: 'string' } }
  });
  const result = sv.validate({ name: 123 });
  assert.ok(!result.valid);
});

test('required fields checked', () => {
  const sv = createSchemaValidator({
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name']
  });
  const result = sv.validate({});
  assert.ok(!result.valid);
});

console.log('\n\x1b[36m  Part 2: Type Coercer\x1b[0m');
test('type-coercer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/type-coercer.mjs'));
});

const { coerce } = await import('../../tools/ogu/commands/lib/type-coercer.mjs');

test('coerce string to number', () => {
  assert.equal(coerce('42', 'number'), 42);
});

test('coerce number to string', () => {
  assert.equal(coerce(42, 'string'), '42');
});

test('coerce to boolean', () => {
  assert.equal(coerce('true', 'boolean'), true);
  assert.equal(coerce(0, 'boolean'), false);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
