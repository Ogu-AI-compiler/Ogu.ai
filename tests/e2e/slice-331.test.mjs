import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 331 — Cursor Tracker + Selection Manager\x1b[0m\n');
console.log('\x1b[36m  Part 1: Cursor Tracker\x1b[0m');
test('cursor-tracker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/cursor-tracker.mjs')));
const { createCursorTracker } = await import('../../tools/ogu/commands/lib/cursor-tracker.mjs');
test('moveTo', () => { const ct = createCursorTracker(); ct.moveTo(5, 10); assert.deepEqual(ct.getPosition(), { line: 5, col: 10 }); });
test('moveBy', () => { const ct = createCursorTracker(); ct.moveTo(5, 10); ct.moveBy(2, -3); assert.deepEqual(ct.getPosition(), { line: 7, col: 7 }); });
test('history', () => { const ct = createCursorTracker(); ct.moveTo(1, 1); ct.moveTo(2, 2); assert.equal(ct.getHistory().length, 2); });
test('reset', () => { const ct = createCursorTracker(); ct.moveTo(5, 5); ct.reset(); assert.deepEqual(ct.getPosition(), { line: 0, col: 0 }); });

console.log('\n\x1b[36m  Part 2: Selection Manager\x1b[0m');
test('selection-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/selection-manager.mjs')));
const { createSelectionManager } = await import('../../tools/ogu/commands/lib/selection-manager.mjs');
test('select range', () => { const sm = createSelectionManager(); sm.select(0, 10, 'hello'); const s = sm.getSelection(); assert.equal(s.start, 0); assert.equal(s.end, 10); });
test('clear selection', () => { const sm = createSelectionManager(); sm.select(0, 5); sm.clear(); assert.ok(!sm.hasSelection()); });
test('expand selection', () => { const sm = createSelectionManager(); sm.select(0, 5); sm.expandTo(15); assert.equal(sm.getSelection().end, 15); });
test('selection history', () => { const sm = createSelectionManager(); sm.select(0, 5); sm.select(5, 10); assert.equal(sm.getHistory().length, 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
