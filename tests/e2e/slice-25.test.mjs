#!/usr/bin/env node

/**
 * Slice 25 — Governance Diff Blocking + Org Health Score (Gap Closure P14 + P15)
 *
 * Proves: Governance blocks based on file diffs, org health score
 *   computed from agents, budget, governance, and pipeline metrics.
 *
 * Tests:
 *   P14: governance diff-check — block/warn on dangerous diff patterns
 *   P15: org-health.mjs — compute org health score from multiple signals
 *
 * Depends on: Slices 1-24
 *
 * Run: node tests/e2e/slice-25.test.mjs
 */

import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Test harness ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ── Helpers ──

const CLI = join(import.meta.dirname, '../../tools/ogu/cli.mjs');
const ROOT = join(import.meta.dirname, '../../');

function ogu(command, args = []) {
  try {
    const output = execFileSync('node', [CLI, command, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--force']);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 25 — Governance Diff Blocking + Org Health Score (P14 + P15)\x1b[0m\n');
console.log('  Diff-based governance blocking, org health score computation\n');

setup();

// ── Part 1: Governance Diff Checker Library ──

console.log('\x1b[36m  Part 1: Governance Diff Checker\x1b[0m');

await test('diff-checker.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/diff-checker.mjs');
  assert(typeof mod.checkDiff === 'function', 'Should export checkDiff');
  assert(typeof mod.DANGEROUS_PATTERNS === 'object', 'Should export DANGEROUS_PATTERNS');
});

await test('checkDiff flags dangerous patterns', async () => {
  const { checkDiff } = await import('../../tools/ogu/commands/lib/diff-checker.mjs');

  const result = checkDiff({
    files: [
      { path: '.env', additions: ['API_KEY=sk-12345'], deletions: [] },
      { path: 'src/main.js', additions: ['console.log("hello")'], deletions: [] },
    ],
  });

  assert(result.warnings.length > 0, 'Should warn about .env changes');
  assert(result.warnings.some(w => w.pattern === 'secrets'), `.env should trigger secrets warning: ${JSON.stringify(result.warnings)}`);
});

await test('checkDiff detects mass deletions', async () => {
  const { checkDiff } = await import('../../tools/ogu/commands/lib/diff-checker.mjs');

  const result = checkDiff({
    files: [
      { path: 'src/main.js', additions: [], deletions: Array(200).fill('// removed line') },
    ],
  });

  assert(result.warnings.some(w => w.pattern === 'mass-deletion'), 'Should warn about mass deletion');
});

await test('checkDiff detects hardcoded credentials', async () => {
  const { checkDiff } = await import('../../tools/ogu/commands/lib/diff-checker.mjs');

  const result = checkDiff({
    files: [
      { path: 'config.js', additions: ['const password = "admin123"', 'const token = "ghp_abc123"'], deletions: [] },
    ],
  });

  assert(result.warnings.some(w => w.pattern === 'hardcoded-secret'), `Should detect hardcoded secrets: ${JSON.stringify(result.warnings)}`);
});

await test('checkDiff clean diff has no warnings', async () => {
  const { checkDiff } = await import('../../tools/ogu/commands/lib/diff-checker.mjs');

  const result = checkDiff({
    files: [
      { path: 'src/utils.js', additions: ['function add(a, b) { return a + b; }'], deletions: [] },
    ],
  });

  assertEqual(result.warnings.length, 0, `Clean diff should have no warnings, got ${result.warnings.length}`);
  assert(result.approved, 'Clean diff should be approved');
});

// ── Part 2: Diff Check CLI ──

console.log('\n\x1b[36m  Part 2: Diff Check CLI\x1b[0m');

await test('governance:diff-check analyzes staged changes', async () => {
  const result = ogu('governance:diff-check', ['--json']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  const check = JSON.parse(result.stdout.trim());
  assert(typeof check.approved === 'boolean', 'Should have approved field');
  assert(Array.isArray(check.warnings), 'Should have warnings array');
});

// ── Part 3: Org Health Score Library ──

console.log('\n\x1b[36m  Part 3: Org Health Score Library\x1b[0m');

await test('org-health.mjs exports computeHealthScore', async () => {
  const mod = await import('../../tools/ogu/commands/lib/org-health.mjs');
  assert(typeof mod.computeHealthScore === 'function', 'Should export computeHealthScore');
});

await test('computeHealthScore returns score with components', async () => {
  const { computeHealthScore } = await import('../../tools/ogu/commands/lib/org-health.mjs');
  const score = computeHealthScore();
  assert(typeof score.overall === 'number', 'Should have overall score');
  assert(score.overall >= 0 && score.overall <= 100, `Score should be 0-100, got ${score.overall}`);
  assert(score.components, 'Should have components');
  assert(typeof score.components.agents === 'number', 'Should have agents component');
  assert(typeof score.components.budget === 'number', 'Should have budget component');
  assert(typeof score.components.governance === 'number', 'Should have governance component');
});

await test('health score reflects active org state', async () => {
  const { computeHealthScore } = await import('../../tools/ogu/commands/lib/org-health.mjs');
  const score = computeHealthScore();
  // After org:init, should have decent health (roles configured, budget set)
  assert(score.overall >= 30, `After org:init should be >= 30, got ${score.overall}`);
  assert(score.components.agents > 0, 'Should have nonzero agents score');
});

// ── Part 4: Health Score CLI ──

console.log('\n\x1b[36m  Part 4: Health Score CLI\x1b[0m');

await test('org:health shows health score', async () => {
  const result = ogu('org:health');
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Health') || result.stdout.includes('health') || result.stdout.includes('Score'),
    `Should show health: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('org:health --json returns structured score', async () => {
  const result = ogu('org:health', ['--json']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  const score = JSON.parse(result.stdout.trim());
  assert(typeof score.overall === 'number', 'Should have overall');
  assert(score.components, 'Should have components');
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
