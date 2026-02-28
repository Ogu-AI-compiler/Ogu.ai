import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 309 — Permission System + RBAC Engine\x1b[0m\n');
console.log('\x1b[36m  Part 1: Permission System\x1b[0m');
test('permission-system.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/permission-system.mjs')));
const { createPermissionSystem } = await import('../../tools/ogu/commands/lib/permission-system.mjs');
test('grant and check permission', () => { const ps = createPermissionSystem(); ps.grant('alice', 'read'); assert.ok(ps.check('alice', 'read')); assert.ok(!ps.check('alice', 'write')); });
test('revoke removes permission', () => { const ps = createPermissionSystem(); ps.grant('bob', 'admin'); ps.revoke('bob', 'admin'); assert.ok(!ps.check('bob', 'admin')); });

console.log('\n\x1b[36m  Part 2: RBAC Engine\x1b[0m');
test('rbac-engine.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/rbac-engine.mjs')));
const { createRBACEngine } = await import('../../tools/ogu/commands/lib/rbac-engine.mjs');
test('role-based access', () => { const rbac = createRBACEngine(); rbac.addRole('editor', ['read','write']); rbac.assignRole('alice', 'editor'); assert.ok(rbac.can('alice', 'write')); assert.ok(!rbac.can('alice', 'delete')); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
