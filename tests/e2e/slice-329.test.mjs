import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 329 — Undo-Redo History + Redo Stack\x1b[0m\n');
console.log('\x1b[36m  Part 1: Undo-Redo History\x1b[0m');
test('undo-redo-history.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/undo-redo-history.mjs')));
const { createUndoRedoHistory } = await import('../../tools/ogu/commands/lib/undo-redo-history.mjs');
test('push and get current', () => { const h = createUndoRedoHistory({ v: 0 }); h.push({ v: 1 }); assert.equal(h.getCurrent().v, 1); });
test('undo', () => { const h = createUndoRedoHistory({ v: 0 }); h.push({ v: 1 }); h.undo(); assert.equal(h.getCurrent().v, 0); });
test('redo', () => { const h = createUndoRedoHistory({ v: 0 }); h.push({ v: 1 }); h.undo(); h.redo(); assert.equal(h.getCurrent().v, 1); });
test('redo cleared after push', () => { const h = createUndoRedoHistory({ v: 0 }); h.push({ v: 1 }); h.undo(); h.push({ v: 2 }); assert.ok(!h.canRedo()); });
test('canUndo/canRedo', () => { const h = createUndoRedoHistory({ v: 0 }); assert.ok(!h.canUndo()); h.push({ v: 1 }); assert.ok(h.canUndo()); });

console.log('\n\x1b[36m  Part 2: Redo Stack\x1b[0m');
test('redo-stack.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/redo-stack.mjs')));
const { createRedoStack } = await import('../../tools/ogu/commands/lib/redo-stack.mjs');
test('push and pop', () => { const rs = createRedoStack(); rs.push('a'); rs.push('b'); assert.equal(rs.pop(), 'b'); });
test('peek', () => { const rs = createRedoStack(); rs.push('x'); assert.equal(rs.peek(), 'x'); });
test('clear', () => { const rs = createRedoStack(); rs.push('a'); rs.clear(); assert.ok(rs.isEmpty()); });
test('size', () => { const rs = createRedoStack(); rs.push(1); rs.push(2); assert.equal(rs.size(), 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
