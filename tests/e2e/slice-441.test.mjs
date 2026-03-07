/**
 * Slice 441 — Slot Assignment UI
 * Tests SlotAssignmentPanel component: agent selection per slot, capacity display, auto-assign.
 */
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 441: Slot Assignment UI ===\n');

const ROOT = process.cwd();
const SAP = join(ROOT, 'tools/studio/src/components/project/SlotAssignmentPanel.tsx');
const TRP = join(ROOT, 'tools/studio/src/components/project/TeamReviewPanel.tsx');

// ── Component exists ─────────────────────────────────────────────────────────

test('SlotAssignmentPanel.tsx exists', () => {
  assert.ok(existsSync(SAP));
});

test('SlotAssignmentPanel exports SlotAssignmentPanel', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('export function SlotAssignmentPanel'));
});

// ── Props ────────────────────────────────────────────────────────────────────

test('SlotAssignmentPanel accepts members and availableAgents props', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('members'));
  assert.ok(src.includes('availableAgents') || src.includes('agents'));
});

test('SlotAssignmentPanel has onAssign callback', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('onAssign'));
});

// ── Agent dropdown / selection ───────────────────────────────────────────────

test('SlotAssignmentPanel renders agent selection UI per slot', () => {
  const src = readFileSync(SAP, 'utf8');
  // Should map over members and show selection
  assert.ok(src.includes('select') || src.includes('Select') || src.includes('dropdown') || src.includes('onClick'));
});

test('SlotAssignmentPanel shows capacity info for agents', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('capacity') || src.includes('Capacity'));
});

// ── Status indicators ────────────────────────────────────────────────────────

test('SlotAssignmentPanel shows assigned vs unassigned status', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('active') || src.includes('assigned'));
  assert.ok(src.includes('unassigned') || src.includes('Unassigned'));
});

test('SlotAssignmentPanel shows role emoji or icon', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('ROLE_EMOJI') || src.includes('role_id') || src.includes('architect'));
});

// ── Auto-assign ──────────────────────────────────────────────────────────────

test('SlotAssignmentPanel has auto-assign or fill-all action', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('autoAssign') || src.includes('Auto') || src.includes('Fill'));
});

// ── Integration with TeamReviewPanel ─────────────────────────────────────────

test('TeamReviewPanel references SlotAssignmentPanel or slot assignment', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('SlotAssignment') || src.includes('assign') || src.includes('Assign'));
});

// ── Design system compliance ─────────────────────────────────────────────────

test('SlotAssignmentPanel uses design tokens (var(--color-*))', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('var(--color-'));
});

test('SlotAssignmentPanel uses consistent section headers', () => {
  const src = readFileSync(SAP, 'utf8');
  assert.ok(src.includes('textTransform') || src.includes('uppercase'));
  assert.ok(src.includes('letterSpacing') || src.includes('tracking'));
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
