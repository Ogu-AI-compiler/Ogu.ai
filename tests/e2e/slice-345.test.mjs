import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 345 — Tag Manager + Branch Strategy\x1b[0m\n');
console.log('\x1b[36m  Part 1: Tag Manager\x1b[0m');
test('tag-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/tag-manager.mjs')));
const { createTagManager } = await import('../../tools/ogu/commands/lib/tag-manager.mjs');
test('add and get tags', () => { const tm = createTagManager(); tm.addTag('file.js', 'important'); tm.addTag('file.js', 'reviewed'); assert.deepEqual(tm.getTags('file.js'), ['important', 'reviewed']); });
test('find by tag', () => { const tm = createTagManager(); tm.addTag('a.js', 'bug'); tm.addTag('b.js', 'bug'); tm.addTag('c.js', 'feature'); assert.deepEqual(tm.findByTag('bug').sort(), ['a.js', 'b.js']); });
test('remove tag', () => { const tm = createTagManager(); tm.addTag('x', 't'); tm.removeTag('x', 't'); assert.equal(tm.getTags('x').length, 0); });
test('list resources', () => { const tm = createTagManager(); tm.addTag('a', 'x'); tm.addTag('b', 'y'); assert.equal(tm.listResources().length, 2); });

console.log('\n\x1b[36m  Part 2: Branch Strategy\x1b[0m');
test('branch-strategy.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/branch-strategy.mjs')));
const { createBranchStrategy } = await import('../../tools/ogu/commands/lib/branch-strategy.mjs');
test('classify branch', () => { const bs = createBranchStrategy(); assert.equal(bs.classify('feature/login'), 'feature'); assert.equal(bs.classify('bugfix/fix-crash'), 'bugfix'); });
test('invalid branch', () => { const bs = createBranchStrategy(); assert.ok(!bs.isValid('random-name')); });
test('suggest branch name', () => { const bs = createBranchStrategy(); assert.equal(bs.suggest('feature', 'login'), 'feature/login'); });
test('list types', () => { const bs = createBranchStrategy(); assert.ok(bs.listTypes().includes('feature')); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
