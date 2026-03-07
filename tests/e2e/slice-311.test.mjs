import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 311 — Sandbox Isolator\x1b[0m\n');
console.log('\x1b[36m  Part 1: Sandbox Isolator\x1b[0m');
test('sandbox-isolator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/sandbox-isolator.mjs')));
const { createSandboxIsolator } = await import('../../tools/ogu/commands/lib/sandbox-isolator.mjs');
test('create sandbox', () => { const sb = createSandboxIsolator(); const id = sb.create('test', { env: { x: 1 } }); assert.ok(id > 0); });
test('run in sandbox', () => { const sb = createSandboxIsolator(); const id = sb.create('calc', { env: { a: 5 } }); const r = sb.run(id, env => env.a * 2); assert.equal(r, 10); });
test('list sandboxes', () => { const sb = createSandboxIsolator(); sb.create('s1'); sb.create('s2'); assert.equal(sb.list().length, 2); });
test('destroy sandbox', () => { const sb = createSandboxIsolator(); const id = sb.create('temp'); sb.destroy(id); assert.equal(sb.list().length, 0); });
test('get log', () => { const sb = createSandboxIsolator(); const id = sb.create('log'); sb.run(id, () => 42); assert.equal(sb.getLog(id).length, 1); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
