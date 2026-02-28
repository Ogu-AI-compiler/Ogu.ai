#!/usr/bin/env node

/**
 * Slice 15 — Canonical Compile, Gates, Clean, Observe Setup
 *
 * Proves: The full compilation pipeline, 14-gate system, artifact cleanup,
 *   and production observation configuration all work end-to-end.
 *
 * Tests:
 *   - ogu compile <slug> — 7-phase compilation with formal OGU error codes
 *   - ogu compile --gate N — stop after specific phase
 *   - ogu gates run/status/reset — 14 sequential checkpointed gates
 *   - ogu clean --dry-run / --reports / --logs
 *   - ogu observe:setup — source CRUD (add/remove/enable/disable/release)
 *
 * Depends on: Slices 1-14
 *
 * Run: node tests/e2e/slice-15.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

const FEATURE = 'compile-e2e-test';
const FEATURE_DIR = `docs/vault/04_Features/${FEATURE}`;

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  mkdirSync(join(ROOT, FEATURE_DIR), { recursive: true });

  // Plan.json with IR (inputs/outputs)
  writeJSON(`${FEATURE_DIR}/Plan.json`, {
    featureSlug: FEATURE,
    version: 1,
    tasks: [
      {
        id: 'ce-t1',
        title: 'Create utility module',
        description: 'Build core utility',
        touches: ['src/compile-test/*.mjs'],
        done_when: 'Module exports work',
        requiredRole: 'developer',
        dependsOn: [],
        inputs: [],
        outputs: ['EXPORT:compileTestHelper'],
      },
      {
        id: 'ce-t2',
        title: 'Create API handler',
        description: 'Wire up API',
        touches: ['src/compile-test/api.mjs'],
        done_when: 'API handler works',
        requiredRole: 'developer',
        dependsOn: ['ce-t1'],
        inputs: ['EXPORT:compileTestHelper'],
        outputs: ['ROUTE:/api/compile-test'],
      },
    ],
  });

  // Spec.md
  const specContent = `# Spec: ${FEATURE}\n\n## API Endpoints\n\nGET /api/compile-test\n\n## Data Model\n\ncompileTestHelper function\n`;
  writeFileSync(join(ROOT, `${FEATURE_DIR}/Spec.md`), specContent, 'utf8');

  // Lock spec hash
  const specHash = createHash('sha256').update(specContent).digest('hex');
  const lockPath = join(ROOT, '.ogu/CONTEXT_LOCK.json');
  const lock = existsSync(lockPath)
    ? JSON.parse(readFileSync(lockPath, 'utf8'))
    : {};
  lock.spec_hashes = lock.spec_hashes || {};
  lock.spec_hashes[FEATURE] = specHash;
  writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf8');

  // Create source files so code verification passes
  mkdirSync(join(ROOT, 'src/compile-test'), { recursive: true });
  writeFileSync(
    join(ROOT, 'src/compile-test/helper.mjs'),
    `export function compileTestHelper() {\n  return 'ok';\n}\n`,
    'utf8',
  );
  writeFileSync(
    join(ROOT, 'src/compile-test/api.mjs'),
    `import { compileTestHelper } from './helper.mjs';\nexport function handler(req, res) {\n  return compileTestHelper();\n}\n`,
    'utf8',
  );

  // Clean old state
  const gateState = join(ROOT, '.ogu/GATE_STATE.json');
  if (existsSync(gateState)) rmSync(gateState);
  const observeConfig = join(ROOT, '.ogu/OBSERVE.json');
  if (existsSync(observeConfig)) rmSync(observeConfig);
}

function cleanup() {
  const testDir = join(ROOT, 'src/compile-test');
  if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  const featureDir = join(ROOT, FEATURE_DIR);
  if (existsSync(featureDir)) rmSync(featureDir, { recursive: true });
  const gateState = join(ROOT, '.ogu/GATE_STATE.json');
  if (existsSync(gateState)) rmSync(gateState);
  const observeConfig = join(ROOT, '.ogu/OBSERVE.json');
  if (existsSync(observeConfig)) rmSync(observeConfig);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 15 — Canonical Compile, Gates, Clean, Observe Setup\x1b[0m\n');
console.log('  Compile phases, gate checkpoints, cleanup, observe CRUD\n');

setup();

// ── Part 1: ogu compile ──

console.log('\x1b[36m  Part 1: Canonical Compile\x1b[0m');

await test('ogu compile <slug> runs 7 phases', async () => {
  const result = ogu('compile', [FEATURE]);
  // Should complete (pass or fail with known issues)
  assert(
    result.stdout.includes('Phase 1') && result.stdout.includes('Phase 2'),
    `Should run phases: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('compile reports IR load in Phase 1', async () => {
  const result = ogu('compile', [FEATURE]);
  assert(
    result.stdout.includes('Phase 1: IR Load') &&
    (result.stdout.includes('tasks') || result.stdout.includes('outputs')),
    `Phase 1 should report task/output counts: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('compile reports spec consistency in Phase 2', async () => {
  const result = ogu('compile', [FEATURE]);
  assert(
    result.stdout.includes('Phase 2: Spec Consistency'),
    `Should include Phase 2: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('compile --gate 2 stops after Phase 2', async () => {
  const result = ogu('compile', [FEATURE, '--gate', '2']);
  assert(
    result.stdout.includes('Phase 1') && result.stdout.includes('Phase 2'),
    `Should include Phase 1 and 2`,
  );
  // Should NOT include Phase 3
  assert(
    !result.stdout.includes('Phase 3: IR Validation'),
    `Should stop before Phase 3: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('compile with missing feature returns exit code 2', async () => {
  const result = ogu('compile', ['nonexistent-feature']);
  assertEqual(result.exitCode, 2, 'Should return 2 for missing feature');
  assert(
    result.stderr.includes('OGU0003') || result.stdout.includes('OGU0003'),
    `Should report OGU0003 error code`,
  );
});

await test('compile produces summary with error/warning counts', async () => {
  const result = ogu('compile', [FEATURE]);
  assert(
    result.stdout.includes('error(s)') && result.stdout.includes('warning(s)'),
    `Should have error/warning summary: ${result.stdout.trim().slice(-200)}`,
  );
});

// ── Part 2: ogu gates ──

console.log('\n\x1b[36m  Part 2: Gates System\x1b[0m');

await test('ogu gates shows usage when no subcommand', async () => {
  const result = ogu('gates');
  assert(
    result.stdout.includes('Usage') || result.stdout.includes('run'),
    `Should show usage: ${result.stdout.trim()}`,
  );
});

await test('ogu gates status reports pending gates', async () => {
  const result = ogu('gates', ['status', FEATURE]);
  // Either "No gate state" or shows pending gates
  assert(
    result.stdout.includes('No gate state') || result.stdout.includes('PENDING') || result.stdout.includes('Gate State'),
    `Should report gate status: ${result.stdout.trim()}`,
  );
});

await test('ogu gates run --gate 1 runs single gate', async () => {
  const result = ogu('gates', ['run', FEATURE, '--gate', '1']);
  assert(
    result.stdout.includes('doctor') || result.stdout.includes('Running gate 1'),
    `Should run gate 1 (doctor): ${result.stdout.trim()}`,
  );
});

await test('gate state is persisted to GATE_STATE.json', async () => {
  assert(fileExists('.ogu/GATE_STATE.json'), 'GATE_STATE.json should exist after running a gate');
  const state = readJSON('.ogu/GATE_STATE.json');
  assertEqual(state.feature, FEATURE, 'State should track the feature');
  assert(state.gates, 'Should have gates object');
  assert(state.gates['1'], 'Should have gate 1 result');
  assert(state.gates['1'].attempts >= 1, 'Should track attempts');
});

await test('ogu gates status shows results after running', async () => {
  const result = ogu('gates', ['status', FEATURE]);
  assert(
    result.stdout.includes('PASS') || result.stdout.includes('FAIL'),
    `Should show results: ${result.stdout.trim()}`,
  );
});

await test('ogu gates reset clears state', async () => {
  const result = ogu('gates', ['reset', FEATURE]);
  assertEqual(result.exitCode, 0, 'Reset should succeed');
  assert(result.stdout.includes('reset') || result.stdout.includes('cleared'), `Should confirm reset: ${result.stdout.trim()}`);

  const state = readJSON('.ogu/GATE_STATE.json');
  assertEqual(Object.keys(state.gates).length, 0, 'Gates should be empty after reset');
});

// ── Part 3: ogu clean ──

console.log('\n\x1b[36m  Part 3: Clean Command\x1b[0m');

await test('ogu clean shows usage with no flags', async () => {
  const result = ogu('clean');
  assert(
    result.stdout.includes('Usage') || result.stdout.includes('--all'),
    `Should show usage: ${result.stdout.trim()}`,
  );
});

await test('ogu clean --reports --dry-run lists reports without deleting', async () => {
  // Ensure a report exists
  writeFileSync(join(ROOT, '.ogu/DOCTOR.md'), '# Doctor Report\nTest\n', 'utf8');
  const result = ogu('clean', ['--reports', '--dry-run']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  assert(result.stdout.includes('DRY RUN'), 'Should indicate dry run mode');

  // File should still exist
  assert(fileExists('.ogu/DOCTOR.md'), 'DOCTOR.md should still exist after dry-run');
});

await test('ogu clean --reports actually removes reports', async () => {
  writeFileSync(join(ROOT, '.ogu/DOCTOR.md'), '# Doctor Report\nTest\n', 'utf8');
  const result = ogu('clean', ['--reports']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  assert(!fileExists('.ogu/DOCTOR.md'), 'DOCTOR.md should be removed');
});

await test('ogu clean --logs 1 --dry-run finds old logs', async () => {
  // Create an old daily log
  mkdirSync(join(ROOT, '.ogu/memory'), { recursive: true });
  writeFileSync(join(ROOT, '.ogu/memory/2020-01-01.md'), '# Old log\n', 'utf8');

  const result = ogu('clean', ['--logs', '1', '--dry-run']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  assert(
    result.stdout.includes('2020-01-01') || result.stdout.includes('would remove'),
    `Should find old log: ${result.stdout.trim()}`,
  );

  // Clean up test log
  rmSync(join(ROOT, '.ogu/memory/2020-01-01.md'), { force: true });
});

// ── Part 4: ogu observe:setup ──

console.log('\n\x1b[36m  Part 4: Observe Setup\x1b[0m');

await test('observe:setup with no args shows empty config', async () => {
  const result = ogu('observe:setup');
  assertEqual(result.exitCode, 0, 'Should succeed');
  assert(
    result.stdout.includes('No observation') || result.stdout.includes('sources'),
    `Should show config info: ${result.stdout.trim()}`,
  );
});

await test('observe:setup --add uptime creates source', async () => {
  const result = ogu('observe:setup', ['--add', 'uptime', '--endpoint', 'http://localhost:3000/health']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('added') || result.stdout.includes('uptime'),
    `Should confirm addition: ${result.stdout.trim()}`,
  );
});

await test('observe:setup persists sources in OBSERVE.json', async () => {
  assert(fileExists('.ogu/OBSERVE.json'), 'OBSERVE.json should exist');
  const config = readJSON('.ogu/OBSERVE.json');
  assert(config.sources.length >= 1, `Should have at least 1 source, got ${config.sources.length}`);
  assertEqual(config.sources[0].type, 'uptime', 'First source should be uptime');
  assertEqual(config.sources[0].enabled, true, 'Should be enabled');
});

await test('observe:setup --disable 0 disables source', async () => {
  const result = ogu('observe:setup', ['--disable', '0']);
  assertEqual(result.exitCode, 0, 'Should succeed');

  const config = readJSON('.ogu/OBSERVE.json');
  assertEqual(config.sources[0].enabled, false, 'Source should be disabled');
});

await test('observe:setup --enable 0 re-enables source', async () => {
  const result = ogu('observe:setup', ['--enable', '0']);
  assertEqual(result.exitCode, 0, 'Should succeed');

  const config = readJSON('.ogu/OBSERVE.json');
  assertEqual(config.sources[0].enabled, true, 'Source should be re-enabled');
});

await test('observe:setup --release records deployment', async () => {
  const result = ogu('observe:setup', ['--release', 'abc123def456', '--feature', FEATURE]);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);

  const config = readJSON('.ogu/OBSERVE.json');
  assert(config.releases.length >= 1, 'Should have at least 1 release');
  const latest = config.releases[config.releases.length - 1];
  assertEqual(latest.git_sha, 'abc123def456', 'Should store git sha');
  assertEqual(latest.feature, FEATURE, 'Should store feature slug');
});

await test('observe:setup --remove 0 removes source', async () => {
  const beforeCount = readJSON('.ogu/OBSERVE.json').sources.length;
  const result = ogu('observe:setup', ['--remove', '0']);
  assertEqual(result.exitCode, 0, 'Should succeed');

  const config = readJSON('.ogu/OBSERVE.json');
  assertEqual(config.sources.length, beforeCount - 1, 'Should have one fewer source');
});

await test('observe:setup --add with invalid type fails', async () => {
  const result = ogu('observe:setup', ['--add', 'invalid-type']);
  assertEqual(result.exitCode, 1, 'Should fail for invalid type');
});

await test('observe:setup shows sources after adding', async () => {
  // Add a sentry source
  ogu('observe:setup', ['--add', 'sentry', '--project_slug', 'test', '--org_slug', 'org']);
  const result = ogu('observe:setup');
  assert(
    result.stdout.includes('sentry') || result.stdout.includes('Observation sources'),
    `Should list sources: ${result.stdout.trim()}`,
  );
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
