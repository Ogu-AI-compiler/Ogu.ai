import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 344 — Changelog Generator + Release Manager\x1b[0m\n');
console.log('\x1b[36m  Part 1: Changelog Generator\x1b[0m');
test('changelog-generator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/changelog-generator.mjs')));
const { createChangelogGenerator } = await import('../../tools/ogu/commands/lib/changelog-generator.mjs');
test('generate changelog', () => { const cg = createChangelogGenerator(); cg.addEntry('Features', 'Add dark mode', 'UI'); cg.addEntry('Fixes', 'Fix login bug'); const md = cg.generate('1.0.0'); assert.ok(md.includes('1.0.0')); assert.ok(md.includes('dark mode')); });
test('count entries', () => { const cg = createChangelogGenerator(); cg.addEntry('Features', 'A'); cg.addEntry('Features', 'B'); assert.equal(cg.count(), 2); });
test('clear', () => { const cg = createChangelogGenerator(); cg.addEntry('X', 'Y'); cg.clear(); assert.equal(cg.count(), 0); });

console.log('\n\x1b[36m  Part 2: Release Manager\x1b[0m');
test('release-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/release-manager.mjs')));
const { createReleaseManager } = await import('../../tools/ogu/commands/lib/release-manager.mjs');
test('create release', () => { const rm = createReleaseManager(); const r = rm.create('1.0.0', 'Initial release'); assert.equal(r.status, 'draft'); });
test('publish release', () => { const rm = createReleaseManager(); rm.create('1.0.0'); rm.publish('1.0.0'); assert.equal(rm.getRelease('1.0.0').status, 'published'); });
test('list releases', () => { const rm = createReleaseManager(); rm.create('1.0.0'); rm.create('2.0.0'); assert.equal(rm.list().length, 2); });
test('latest release', () => { const rm = createReleaseManager(); rm.create('1.0.0'); rm.create('2.0.0'); assert.equal(rm.latest().version, '2.0.0'); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
