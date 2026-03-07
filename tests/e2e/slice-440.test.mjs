/**
 * Slice 440 — Team Review & Approval Screen
 * Tests TeamReviewPanel component structure and integration.
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

console.log('\n=== Slice 440: Team Review & Approval Screen ===\n');

const ROOT = process.cwd();
const MPV = join(ROOT, 'tools/studio/src/components/project/MarketplaceProjectView.tsx');
const TRP = join(ROOT, 'tools/studio/src/components/project/TeamReviewPanel.tsx');

// ── TeamReviewPanel component exists ────────────────────────────────────────

test('TeamReviewPanel.tsx exists', () => {
  assert.ok(existsSync(TRP));
});

test('TeamReviewPanel exports TeamReviewPanel', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('export function TeamReviewPanel'));
});

// ── Shows blueprint roles ───────────────────────────────────────────────────

test('TeamReviewPanel accepts blueprint prop', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('blueprint'));
  assert.ok(src.includes('roles'));
});

test('TeamReviewPanel shows role cards with role_id and count', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('role_id') || src.includes('roleId'));
  assert.ok(src.includes('count'));
});

test('TeamReviewPanel shows complexity tier badge', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('complexity') || src.includes('tier'));
});

// ── Role emoji mapping ──────────────────────────────────────────────────────

test('TeamReviewPanel has ROLE_EMOJI or role icons', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('ROLE_EMOJI') || src.includes('ROLE_ICON') || src.includes('architect'));
});

// ── Approve / Modify actions ────────────────────────────────────────────────

test('TeamReviewPanel has Approve Team button', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('Approve') || src.includes('approve'));
});

test('TeamReviewPanel has callback for approval', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('onApprove'));
});

test('TeamReviewPanel has option to add/remove roles', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('onModify') || src.includes('removeRole') || src.includes('addRole') || src.includes('modify'));
});

// ── Unassigned slots warning ────────────────────────────────────────────────

test('TeamReviewPanel shows unassigned count', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('unassigned') || src.includes('Unassigned'));
});

// ── Integration with MarketplaceProjectView ─────────────────────────────────

test('MarketplaceProjectView imports TeamReviewPanel', () => {
  const src = readFileSync(MPV, 'utf8');
  assert.ok(src.includes('TeamReviewPanel'));
});

test('MarketplaceProjectView renders TeamReviewPanel at team phase', () => {
  const src = readFileSync(MPV, 'utf8');
  assert.ok(src.includes('TeamReviewPanel'));
  // Should be rendered when team exists but enriched plan doesn't
  assert.ok(src.includes('team') && src.includes('blueprint'));
});

// ── Design system compliance ────────────────────────────────────────────────

test('TeamReviewPanel uses design tokens (var(--color-*))', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('var(--color-'));
});

test('TeamReviewPanel uses consistent section headers (uppercase, letter-spacing)', () => {
  const src = readFileSync(TRP, 'utf8');
  assert.ok(src.includes('textTransform') || src.includes('uppercase'));
  assert.ok(src.includes('letterSpacing') || src.includes('tracking'));
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
