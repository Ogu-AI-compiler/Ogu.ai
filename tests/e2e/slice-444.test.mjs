/**
 * Slice 444 — Project Complete Screen
 * Tests ProjectCompletePanel: summary stats, artifact links, timeline, next actions.
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

console.log('\n=== Slice 444: Project Complete Screen ===\n');

const ROOT = process.cwd();
const PCP = join(ROOT, 'tools/studio/src/components/project/ProjectCompletePanel.tsx');
const MPV = join(ROOT, 'tools/studio/src/components/project/MarketplaceProjectView.tsx');

// ── Component exists ─────────────────────────────────────────────────────────

test('ProjectCompletePanel.tsx exists', () => {
  assert.ok(existsSync(PCP));
});

test('ProjectCompletePanel exports ProjectCompletePanel', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('export function ProjectCompletePanel'));
});

// ── Summary stats ────────────────────────────────────────────────────────────

test('ProjectCompletePanel shows task completion stats', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('completed') || src.includes('Completed'));
  assert.ok(src.includes('total') || src.includes('Total'));
});

test('ProjectCompletePanel shows duration or time', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('duration') || src.includes('Duration') || src.includes('time') || src.includes('elapsed'));
});

test('ProjectCompletePanel shows agent count', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('agent') || src.includes('Agent') || src.includes('team'));
});

// ── Artifacts ────────────────────────────────────────────────────────────────

test('ProjectCompletePanel shows output artifacts or files', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('artifact') || src.includes('Artifact') || src.includes('output') || src.includes('files'));
});

// ── Next actions ─────────────────────────────────────────────────────────────

test('ProjectCompletePanel has next action (deploy, observe, new project)', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(
    src.includes('Deploy') || src.includes('deploy') ||
    src.includes('Observe') || src.includes('observe') ||
    src.includes('New Project') || src.includes('newProject') ||
    src.includes('next')
  );
});

// ── Success indicator ────────────────────────────────────────────────────────

test('ProjectCompletePanel shows success state', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(
    src.includes('success') || src.includes('Success') ||
    src.includes('Complete') || src.includes('\u2713') || src.includes('\u2705')
  );
});

// ── Integration ──────────────────────────────────────────────────────────────

test('MarketplaceProjectView references ProjectCompletePanel', () => {
  const src = readFileSync(MPV, 'utf8');
  assert.ok(src.includes('ProjectComplete') || src.includes('projectComplete'));
});

// ── Design ───────────────────────────────────────────────────────────────────

test('ProjectCompletePanel uses design tokens', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('var(--color-'));
});

test('ProjectCompletePanel uses success colors', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('#22c55e') || src.includes('color-success') || src.includes('color-accent'));
});

test('ProjectCompletePanel uses section header style', () => {
  const src = readFileSync(PCP, 'utf8');
  assert.ok(src.includes('textTransform') || src.includes('uppercase'));
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
