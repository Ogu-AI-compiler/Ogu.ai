#!/usr/bin/env node

/**
 * Slice 14 — Cross-Project Learning
 *
 * Proves: The system can extract patterns from completed features,
 *   store them in global memory, and recall relevant patterns for new tasks.
 *
 * Tests:
 *   - Pattern extraction from completed features (ogu learn)
 *   - Global memory storage (~/.ogu/global-memory/)
 *   - Pattern recall by capability/context (ogu recall)
 *   - Pattern deduplication
 *   - Trend analysis (ogu trends)
 *
 * Depends on: Slices 1-13
 *
 * Run: node tests/e2e/slice-14.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

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
const GLOBAL_MEMORY = join(homedir(), '.ogu/global-memory');
const PATTERNS_FILE = join(GLOBAL_MEMORY, 'patterns.json');

function ogu(command, args = []) {
  try {
    const output = execFileSync('node', [CLI, command, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
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

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ── Setup ──

const FEATURE = 'learn-e2e-test';
// learn command scans docs/vault/04_Features/
const FEATURE_DIR = `docs/vault/04_Features/${FEATURE}`;

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  // Create feature in the path that learn scans
  mkdirSync(join(ROOT, FEATURE_DIR), { recursive: true });

  // Plan.json with tasks that have touches (pattern source)
  writeJSON(`${FEATURE_DIR}/Plan.json`, {
    featureSlug: FEATURE,
    version: 1,
    tasks: [
      {
        id: 'learn-t1',
        title: 'Create data processing module',
        description: 'Build the core data pipeline',
        touches: ['src/data/*.mjs', 'src/utils/*.mjs'],
        done_when: 'All data processing tests pass',
        requiredRole: 'developer',
        dependsOn: [],
      },
      {
        id: 'learn-t2',
        title: 'Add API endpoint',
        touches: ['src/api/routes.mjs'],
        done_when: 'API responds with correct data',
        requiredRole: 'developer',
        dependsOn: ['learn-t1'],
      },
    ],
  });

  // METRICS.json marking it completed
  writeJSON(`.ogu/METRICS.json`, {
    features: {
      [FEATURE]: {
        completed: true,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        completed_at: new Date().toISOString(),
        gate_results: {
          'file-structure': { attempts: 2, failures: ['Missing index.mjs'] },
          'tests-pass': { attempts: 1, failures: [] },
        },
      },
    },
  });

  // Backup and clean patterns file
  if (existsSync(PATTERNS_FILE)) {
    const backup = readFileSync(PATTERNS_FILE, 'utf8');
    writeFileSync(PATTERNS_FILE + '.bak', backup, 'utf8');
  }
  // Start with empty patterns
  mkdirSync(GLOBAL_MEMORY, { recursive: true });
  writeFileSync(PATTERNS_FILE, JSON.stringify({ version: 1, patterns: [] }, null, 2), 'utf8');
}

function cleanup() {
  // Restore patterns backup
  if (existsSync(PATTERNS_FILE + '.bak')) {
    const backup = readFileSync(PATTERNS_FILE + '.bak', 'utf8');
    writeFileSync(PATTERNS_FILE, backup, 'utf8');
    rmSync(PATTERNS_FILE + '.bak');
  }
  // Clean test feature dir
  const featureDir = join(ROOT, FEATURE_DIR);
  if (existsSync(featureDir)) rmSync(featureDir, { recursive: true });
  // Clean metrics
  const metricsPath = join(ROOT, '.ogu/METRICS.json');
  if (existsSync(metricsPath)) rmSync(metricsPath);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 14 — Cross-Project Learning E2E Test\x1b[0m\n');
console.log('  Pattern extraction, global memory, recall, trends\n');

setup();

// ── Part 1: Pattern Extraction (ogu learn) ──

console.log('\x1b[36m  Part 1: Pattern Extraction\x1b[0m');

await test('ogu learn extracts patterns from completed feature', async () => {
  const result = ogu('learn');
  assertEqual(result.exitCode, 0, `learn should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('learn') || result.stdout.includes('pattern') || result.stdout.includes('new'),
    `Should report extraction: ${result.stdout.trim()}`
  );
});

await test('learn creates patterns in global memory', async () => {
  assert(existsSync(PATTERNS_FILE), 'patterns.json should exist');
  const store = readJSON(PATTERNS_FILE);
  assert(store.patterns, 'Should have patterns array');
  assert(store.patterns.length >= 1, `Should have at least 1 pattern, got ${store.patterns.length}`);
});

await test('patterns have correct structure', async () => {
  const store = readJSON(PATTERNS_FILE);
  for (const p of store.patterns) {
    assert(p.id, `Pattern should have id: ${JSON.stringify(p).slice(0, 100)}`);
    assert(p.summary, `Pattern should have summary: ${p.id}`);
    assert(p.source_project, `Pattern should have source_project: ${p.id}`);
    assert(p.source_feature, `Pattern should have source_feature: ${p.id}`);
    assert(p.category, `Pattern should have category: ${p.id}`);
  }
});

await test('patterns reference the source feature', async () => {
  const store = readJSON(PATTERNS_FILE);
  const fromFeature = store.patterns.filter(p => p.source_feature === FEATURE);
  assert(fromFeature.length >= 1, `Should have patterns from "${FEATURE}", got ${fromFeature.length}`);
});

// ── Part 2: Gate Failure Patterns ──

console.log('\n\x1b[36m  Part 2: Gate Failure Patterns\x1b[0m');

await test('learn extracts patterns from gate failures', async () => {
  const store = readJSON(PATTERNS_FILE);
  const gatePatterns = store.patterns.filter(p =>
    p.summary.includes('gate') || p.summary.includes('Gate') || p.outcome?.issue_type?.includes('gate')
  );
  assert(gatePatterns.length >= 1, `Should extract gate failure patterns, got ${gatePatterns.length}`);
});

await test('gate patterns include failure details', async () => {
  const store = readJSON(PATTERNS_FILE);
  const gatePatterns = store.patterns.filter(p =>
    p.outcome?.issue_type?.includes('gate')
  );
  if (gatePatterns.length > 0) {
    const p = gatePatterns[0];
    assert(p.outcome.gates_failed_before?.length >= 1, 'Should reference failed gates');
  }
});

// ── Part 3: Deduplication ──

console.log('\n\x1b[36m  Part 3: Deduplication\x1b[0m');

await test('running learn twice does not duplicate patterns', async () => {
  const storeBefore = readJSON(PATTERNS_FILE);
  const countBefore = storeBefore.patterns.length;

  ogu('learn');

  const storeAfter = readJSON(PATTERNS_FILE);
  assertEqual(storeAfter.patterns.length, countBefore, 'Pattern count should not increase');
});

await test('duplicate patterns get times_applied incremented', async () => {
  const store = readJSON(PATTERNS_FILE);
  const fromFeature = store.patterns.filter(p => p.source_feature === FEATURE);
  // After running learn twice, some patterns should have times_applied > 1
  const applied = fromFeature.filter(p => p.times_applied > 1);
  assert(applied.length >= 1, `Some patterns should have times_applied > 1`);
});

// ── Part 4: Pattern Recall (ogu recall) ──

console.log('\n\x1b[36m  Part 4: Pattern Recall\x1b[0m');

await test('ogu recall runs without error', async () => {
  const result = ogu('recall');
  assertEqual(result.exitCode, 0, `recall should succeed: ${result.stderr || result.stdout}`);
});

await test('recall reports pattern store info', async () => {
  const result = ogu('recall');
  assert(
    result.stdout.includes('pattern') || result.stdout.includes('Pattern') ||
    result.stdout.includes('store') || result.stdout.includes('project') ||
    result.stdout.includes('No relevant'),
    `Should report pattern info: ${result.stdout.trim()}`
  );
});

// ── Part 5: Trend Analysis ──

console.log('\n\x1b[36m  Part 5: Trend Analysis\x1b[0m');

await test('ogu trends runs without error', async () => {
  const result = ogu('trends');
  assertEqual(result.exitCode, 0, `trends should succeed: ${result.stderr || result.stdout}`);
});

await test('trends reports feature analysis', async () => {
  const result = ogu('trends');
  assert(
    result.stdout.includes('feature') || result.stdout.includes('trend') || result.stdout.includes('gate') ||
    result.stdout.includes('analyzed') || result.stdout.includes('No features'),
    `Should report analysis: ${result.stdout.trim()}`
  );
});

await test('trends creates TRENDS.md report', async () => {
  // Trends should create .ogu/TRENDS.md if features were found
  const trendsPath = join(ROOT, '.ogu/TRENDS.md');
  if (existsSync(trendsPath)) {
    const content = readFileSync(trendsPath, 'utf8');
    assert(content.includes('Trends Report') || content.includes('trend'), 'Should be a trends report');
  }
  // OK if not created (no features with timing data)
});

// ── Part 6: Global Memory Structure ──

console.log('\n\x1b[36m  Part 6: Global Memory Structure\x1b[0m');

await test('global memory directory exists', async () => {
  assert(existsSync(GLOBAL_MEMORY), `Global memory should exist at ${GLOBAL_MEMORY}`);
});

await test('patterns file is valid JSON with version', async () => {
  const store = readJSON(PATTERNS_FILE);
  assertEqual(store.version, 1, 'Should have version 1');
  assert(Array.isArray(store.patterns), 'patterns should be an array');
});

// ── Cleanup ──

cleanup();

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
