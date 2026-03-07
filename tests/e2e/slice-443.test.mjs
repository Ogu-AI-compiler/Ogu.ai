/**
 * Slice 443 — Error Recovery UI
 * Tests ErrorRecoveryPanel: failed task list, retry action, error details, skip option.
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

console.log('\n=== Slice 443: Error Recovery UI ===\n');

const ROOT = process.cwd();
const ERP = join(ROOT, 'tools/studio/src/components/project/ErrorRecoveryPanel.tsx');
const MPV = join(ROOT, 'tools/studio/src/components/project/MarketplaceProjectView.tsx');

// ── Component exists ─────────────────────────────────────────────────────────

test('ErrorRecoveryPanel.tsx exists', () => {
  assert.ok(existsSync(ERP));
});

test('ErrorRecoveryPanel exports ErrorRecoveryPanel', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('export function ErrorRecoveryPanel'));
});

// ── Failed task list ─────────────────────────────────────────────────────────

test('ErrorRecoveryPanel shows failed tasks', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('failed') || src.includes('Failed'));
});

test('ErrorRecoveryPanel shows error message per task', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('error') || src.includes('Error'));
  assert.ok(src.includes('message') || src.includes('details'));
});

test('ErrorRecoveryPanel shows task name/id', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('taskId') || src.includes('taskName') || src.includes('name'));
});

// ── Retry action ─────────────────────────────────────────────────────────────

test('ErrorRecoveryPanel has retry button', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('retry') || src.includes('Retry'));
});

test('ErrorRecoveryPanel has onRetry callback', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('onRetry'));
});

// ── Skip option ──────────────────────────────────────────────────────────────

test('ErrorRecoveryPanel has skip option', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('skip') || src.includes('Skip') || src.includes('dismiss'));
});

// ── Gate feedback ────────────────────────────────────────────────────────────

test('ErrorRecoveryPanel shows gate or error type', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('gate') || src.includes('Gate') || src.includes('type') || src.includes('severity'));
});

// ── Integration ──────────────────────────────────────────────────────────────

test('MarketplaceProjectView references ErrorRecoveryPanel', () => {
  const src = readFileSync(MPV, 'utf8');
  assert.ok(src.includes('ErrorRecovery') || src.includes('errorRecovery'));
});

// ── Design ───────────────────────────────────────────────────────────────────

test('ErrorRecoveryPanel uses design tokens', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('var(--color-'));
});

test('ErrorRecoveryPanel uses error/danger colors', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('#ef4444') || src.includes('color-error') || src.includes('color-danger'));
});

test('ErrorRecoveryPanel uses section header style', () => {
  const src = readFileSync(ERP, 'utf8');
  assert.ok(src.includes('textTransform') || src.includes('uppercase'));
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
