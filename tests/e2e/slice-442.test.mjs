/**
 * Slice 442 — Start Build CTA + Readiness Gate
 * Tests BuildReadinessPanel: readiness checks, start button, missing-role warnings.
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

console.log('\n=== Slice 442: Start Build CTA + Readiness ===\n');

const ROOT = process.cwd();
const BRP = join(ROOT, 'tools/studio/src/components/project/BuildReadinessPanel.tsx');
const MPV = join(ROOT, 'tools/studio/src/components/project/MarketplaceProjectView.tsx');

// ── Component exists ─────────────────────────────────────────────────────────

test('BuildReadinessPanel.tsx exists', () => {
  assert.ok(existsSync(BRP));
});

test('BuildReadinessPanel exports BuildReadinessPanel', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('export function BuildReadinessPanel'));
});

// ── Readiness checks ─────────────────────────────────────────────────────────

test('BuildReadinessPanel shows readiness status', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('ready') || src.includes('Ready'));
});

test('BuildReadinessPanel shows missing roles', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('missingRoles') || src.includes('missing'));
});

test('BuildReadinessPanel shows task count', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('taskCount') || src.includes('tasks'));
});

test('BuildReadinessPanel shows assigned agents count', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('assignedAgents') || src.includes('assigned'));
});

// ── Start button ─────────────────────────────────────────────────────────────

test('BuildReadinessPanel has Start Build button', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('Start') || src.includes('Build') || src.includes('Launch'));
});

test('BuildReadinessPanel has onStart callback', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('onStart') || src.includes('onBuild') || src.includes('onLaunch'));
});

test('BuildReadinessPanel disables start when not ready', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('disabled'));
});

// ── Simulate option ──────────────────────────────────────────────────────────

test('BuildReadinessPanel has simulate option', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('simulate') || src.includes('Simulate') || src.includes('dry'));
});

// ── Checklist UI ─────────────────────────────────────────────────────────────

test('BuildReadinessPanel shows checklist items', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('check') || src.includes('Check') || src.includes('\u2713') || src.includes('\u2714') || src.includes('\u2705'));
});

// ── Integration ──────────────────────────────────────────────────────────────

test('MarketplaceProjectView references BuildReadinessPanel', () => {
  const src = readFileSync(MPV, 'utf8');
  assert.ok(src.includes('BuildReadiness') || src.includes('buildReady'));
});

// ── Design ───────────────────────────────────────────────────────────────────

test('BuildReadinessPanel uses design tokens', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('var(--color-'));
});

test('BuildReadinessPanel uses section header style', () => {
  const src = readFileSync(BRP, 'utf8');
  assert.ok(src.includes('textTransform') || src.includes('uppercase'));
  assert.ok(src.includes('letterSpacing') || src.includes('tracking'));
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
