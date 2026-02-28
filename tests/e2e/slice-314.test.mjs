import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 314 — Audit Logger + Compliance Checker\x1b[0m\n');
console.log('\x1b[36m  Part 1: Audit Logger\x1b[0m');
test('audit-logger.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/audit-logger.mjs')));
const { createAuditLogger } = await import('../../tools/ogu/commands/lib/audit-logger.mjs');
test('log entries', () => { const al = createAuditLogger(); al.log('CREATE', 'alice', { item: 'doc1' }); assert.equal(al.count(), 1); });
test('query by action', () => { const al = createAuditLogger(); al.log('CREATE', 'a'); al.log('DELETE', 'b'); al.log('CREATE', 'c'); assert.equal(al.query({ action: 'CREATE' }).length, 2); });
test('query by user', () => { const al = createAuditLogger(); al.log('X', 'alice'); al.log('Y', 'bob'); assert.equal(al.query({ user: 'alice' }).length, 1); });
test('last N entries', () => { const al = createAuditLogger(); for (let i = 0; i < 20; i++) al.log('A', 'u'); assert.equal(al.last(5).length, 5); });

console.log('\n\x1b[36m  Part 2: Compliance Checker\x1b[0m');
test('compliance-checker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/compliance-checker.mjs')));
const { createComplianceChecker } = await import('../../tools/ogu/commands/lib/compliance-checker.mjs');
test('passes valid data', () => { const cc = createComplianceChecker(); cc.addRule('hasName', d => !!d.name); const r = cc.validate({ name: 'ok' }); assert.ok(r.valid); });
test('reports violations', () => { const cc = createComplianceChecker(); cc.addRule('hasName', d => !!d.name); cc.addRule('hasAge', d => d.age > 0); const r = cc.validate({ name: 'x' }); assert.ok(!r.valid); assert.deepEqual(r.violations, ['hasAge']); });
test('remove rule', () => { const cc = createComplianceChecker(); cc.addRule('r1', () => true); cc.removeRule('r1'); assert.equal(cc.listRules().length, 0); });
test('list rules', () => { const cc = createComplianceChecker(); cc.addRule('a', () => true); cc.addRule('b', () => true); assert.deepEqual(cc.listRules(), ['a', 'b']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
