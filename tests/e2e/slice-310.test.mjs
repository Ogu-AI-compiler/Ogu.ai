import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 310 — Resource Guard + Capability Checker\x1b[0m\n');
console.log('\x1b[36m  Part 1: Resource Guard\x1b[0m');
test('resource-guard.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/resource-guard.mjs')));
const { createResourceGuard } = await import('../../tools/ogu/commands/lib/resource-guard.mjs');
test('protect and access', () => { const rg = createResourceGuard(); rg.protect('db', (user) => user.role === 'admin'); assert.ok(rg.canAccess('db', { role: 'admin' })); assert.ok(!rg.canAccess('db', { role: 'user' })); });

console.log('\n\x1b[36m  Part 2: Capability Checker\x1b[0m');
test('capability-checker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/capability-checker.mjs')));
const { createCapabilityChecker } = await import('../../tools/ogu/commands/lib/capability-checker.mjs');
test('grant and check capability', () => { const cc = createCapabilityChecker(); cc.grant('user1', 'file:read'); cc.grant('user1', 'file:write'); assert.ok(cc.has('user1', 'file:read')); assert.ok(!cc.has('user1', 'file:delete')); });
test('listCapabilities', () => { const cc = createCapabilityChecker(); cc.grant('u', 'a'); cc.grant('u', 'b'); assert.equal(cc.list('u').length, 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
