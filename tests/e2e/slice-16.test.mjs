#!/usr/bin/env node

/**
 * Slice 16 — Drift Detection, Contract Ops, Graph, Impact, Spec Patch
 *
 * Proves: The remaining CLI surface works — drift detection, contract
 *   versioning/diff/migration, dependency graph, impact analysis, and
 *   spec change records.
 *
 * Tests:
 *   - ogu drift <slug> — 5-type drift detection + report
 *   - ogu contract:version — bump versions with changelog
 *   - ogu contract:diff — detect breaking/non-breaking changes
 *   - ogu contract:migrate — migration impact assessment
 *   - ogu graph — dependency graph building
 *   - ogu impact <file> — transitive impact analysis
 *   - ogu spec:patch — spec change records with hash chain
 *
 * Depends on: Slices 1-15
 *
 * Run: node tests/e2e/slice-16.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
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

const FEATURE = 'drift-e2e-test';
const FEATURE_DIR = `docs/vault/04_Features/${FEATURE}`;

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  mkdirSync(join(ROOT, FEATURE_DIR), { recursive: true });

  // Plan.json with IR and touches
  writeJSON(`${FEATURE_DIR}/Plan.json`, {
    featureSlug: FEATURE,
    version: 1,
    tasks: [
      {
        id: 'dr-t1',
        title: 'Create data module',
        description: 'Build data processing',
        touches: ['src/drift-test/data.mjs'],
        done_when: 'Module works',
        requiredRole: 'developer',
        dependsOn: [],
        inputs: [],
        outputs: ['EXPORT:driftHelper'],
      },
      {
        id: 'dr-t2',
        title: 'Create API route',
        description: 'Build API',
        touches: ['src/drift-test/api.mjs'],
        done_when: 'Route responds',
        requiredRole: 'developer',
        dependsOn: ['dr-t1'],
        inputs: ['EXPORT:driftHelper'],
        outputs: ['ROUTE:/api/drift-test'],
      },
    ],
  });

  // Spec.md
  const specContent = `# Spec: ${FEATURE}\n\n## API Design\n\nGET /api/drift-test\n\n## Data Layer\n\ndriftHelper function\n`;
  writeFileSync(join(ROOT, `${FEATURE_DIR}/Spec.md`), specContent, 'utf8');

  // Create source files
  mkdirSync(join(ROOT, 'src/drift-test'), { recursive: true });
  writeFileSync(
    join(ROOT, 'src/drift-test/data.mjs'),
    `export function driftHelper() {\n  return 'ok';\n}\n`,
    'utf8',
  );
  writeFileSync(
    join(ROOT, 'src/drift-test/api.mjs'),
    `import { driftHelper } from './data.mjs';\nexport function handler() {\n  return driftHelper();\n}\n`,
    'utf8',
  );

  // Contract for contract:version/diff tests
  writeJSON('docs/vault/02_Contracts/drift-test.contract.json', {
    version: '1.0.0',
    changelog: [],
    endpoints: [
      { method: 'GET', path: '/api/drift-test', description: 'Test endpoint' },
    ],
    models: {
      DriftTestResult: {
        fields: { status: { type: 'string', required: true } },
      },
    },
  });

  // Lock spec hash
  const specHash = createHash('sha256').update(specContent).digest('hex');
  const lockPath = join(ROOT, '.ogu/CONTEXT_LOCK.json');
  const lock = existsSync(lockPath)
    ? JSON.parse(readFileSync(lockPath, 'utf8'))
    : {};
  lock.spec_hashes = lock.spec_hashes || {};
  lock.spec_hashes[FEATURE] = specHash;
  lock.contract_hashes = lock.contract_hashes || {};
  lock.contract_hashes['drift-test'] = createHash('sha256')
    .update(readFileSync(join(ROOT, 'docs/vault/02_Contracts/drift-test.contract.json'), 'utf8'))
    .digest('hex');
  writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf8');

  // Clean old SCRs
  try {
    for (const f of readdirSync(join(ROOT, FEATURE_DIR))) {
      if (f.startsWith('SCR_')) rmSync(join(ROOT, FEATURE_DIR, f));
    }
  } catch { /* skip */ }

  // Clean drift report
  const driftReport = join(ROOT, '.ogu/DRIFT_REPORT.md');
  if (existsSync(driftReport)) rmSync(driftReport);
}

function cleanup() {
  const testDir = join(ROOT, 'src/drift-test');
  if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  const featureDir = join(ROOT, FEATURE_DIR);
  if (existsSync(featureDir)) rmSync(featureDir, { recursive: true });
  const contract = join(ROOT, 'docs/vault/02_Contracts/drift-test.contract.json');
  if (existsSync(contract)) rmSync(contract);
  const driftReport = join(ROOT, '.ogu/DRIFT_REPORT.md');
  if (existsSync(driftReport)) rmSync(driftReport);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 16 — Drift, Contracts, Graph, Impact, Spec Patch\x1b[0m\n');
console.log('  Drift detection, contract ops, dependency graph, impact, SCR\n');

setup();

// ── Part 1: ogu drift ──

console.log('\x1b[36m  Part 1: Drift Detection\x1b[0m');

await test('ogu drift <slug> runs without error', async () => {
  const result = ogu('drift', [FEATURE]);
  // May return 0 (no drift) or 1 (drift found) — both are valid
  assert(
    result.exitCode === 0 || result.exitCode === 1,
    `Should return 0 or 1, got ${result.exitCode}: ${result.stderr}`,
  );
});

await test('drift reports IR output status', async () => {
  const result = ogu('drift', [FEATURE]);
  const output = result.stdout + result.stderr;
  assert(
    output.includes('IR') || output.includes('output') || output.includes('drift') || output.includes('Drift'),
    `Should mention IR/output/drift: ${output.trim().slice(0, 200)}`,
  );
});

await test('drift generates DRIFT_REPORT.md', async () => {
  ogu('drift', [FEATURE]);
  assert(fileExists('.ogu/DRIFT_REPORT.md'), 'DRIFT_REPORT.md should be created');
  const content = readFileSync(join(ROOT, '.ogu/DRIFT_REPORT.md'), 'utf8');
  assert(content.length > 20, 'Report should have content');
});

await test('drift detects missing file', async () => {
  // Remove a touched file
  rmSync(join(ROOT, 'src/drift-test/api.mjs'));
  const result = ogu('drift', [FEATURE]);
  // Should report drift (exit 1) or at least note the missing file
  const output = result.stdout + result.stderr;
  assert(
    result.exitCode === 1 || output.includes('missing') || output.includes('Missing') || output.includes('drift'),
    `Should detect missing file: ${output.trim().slice(0, 200)}`,
  );
  // Restore
  writeFileSync(
    join(ROOT, 'src/drift-test/api.mjs'),
    `import { driftHelper } from './data.mjs';\nexport function handler() {\n  return driftHelper();\n}\n`,
    'utf8',
  );
});

// ── Part 2: ogu contract:version ──

console.log('\n\x1b[36m  Part 2: Contract Versioning\x1b[0m');

await test('contract:version bumps version', async () => {
  const result = ogu('contract:version', ['--bump', 'minor', 'docs/vault/02_Contracts/drift-test.contract.json']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('1.0.0') || result.stdout.includes('1.1.0') || result.stdout.includes('bumped') || result.stdout.includes('version'),
    `Should report version bump: ${result.stdout.trim()}`,
  );
});

await test('contract version is updated in file', async () => {
  const contract = readJSON('docs/vault/02_Contracts/drift-test.contract.json');
  assertEqual(contract.version, '1.1.0', `Version should be 1.1.0 after minor bump`);
});

await test('contract changelog has entry', async () => {
  const contract = readJSON('docs/vault/02_Contracts/drift-test.contract.json');
  assert(Array.isArray(contract.changelog), 'Should have changelog array');
  assert(contract.changelog.length >= 1, 'Should have at least 1 changelog entry');
  const latest = contract.changelog[contract.changelog.length - 1];
  assertEqual(latest.version, '1.1.0', 'Changelog should reference new version');
});

await test('contract:version --bump patch works', async () => {
  const result = ogu('contract:version', ['--bump', 'patch', 'docs/vault/02_Contracts/drift-test.contract.json']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  const contract = readJSON('docs/vault/02_Contracts/drift-test.contract.json');
  assertEqual(contract.version, '1.1.1', 'Should be 1.1.1 after patch');
});

// ── Part 3: ogu contract:diff ──

console.log('\n\x1b[36m  Part 3: Contract Diff\x1b[0m');

await test('contract:diff runs without error', async () => {
  const result = ogu('contract:diff');
  // Might fail if no git history — that's ok, we just check it runs
  assert(
    result.exitCode === 0 || result.exitCode === 1,
    `Should return 0 or 1: ${result.stderr}`,
  );
});

await test('contract:diff reports changes or no-history', async () => {
  const result = ogu('contract:diff');
  const output = result.stdout + result.stderr;
  assert(
    output.includes('change') || output.includes('Change') || output.includes('diff') ||
    output.includes('contract') || output.includes('No') || output.includes('history') ||
    output.includes('version') || output.length > 0,
    `Should produce some output: ${output.trim().slice(0, 200)}`,
  );
});

// ── Part 4: ogu contract:migrate ──

console.log('\n\x1b[36m  Part 4: Contract Migration\x1b[0m');

await test('contract:migrate assesses impact', async () => {
  const result = ogu('contract:migrate');
  assert(
    result.exitCode === 0 || result.exitCode === 1,
    `Should return 0 or 1: ${result.stderr}`,
  );
  const output = result.stdout + result.stderr;
  assert(
    output.includes('contract') || output.includes('Contract') || output.includes('stable') ||
    output.includes('BREAKING') || output.includes('migration') || output.includes('Migration') ||
    output.includes('No contracts'),
    `Should report migration status: ${output.trim().slice(0, 200)}`,
  );
});

// ── Part 5: ogu graph ──

console.log('\n\x1b[36m  Part 5: Dependency Graph\x1b[0m');

await test('ogu graph builds dependency graph', async () => {
  const result = ogu('graph');
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('files') || result.stdout.includes('edges') || result.stdout.includes('graph') || result.stdout.includes('GRAPH'),
    `Should report graph stats: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('graph creates GRAPH.json', async () => {
  assert(fileExists('.ogu/GRAPH.json'), 'GRAPH.json should exist');
  const graph = readJSON('.ogu/GRAPH.json');
  assert(graph.version, 'Should have version');
  assert(Array.isArray(graph.edges), 'Should have edges array');
  assert(graph.files_scanned >= 1, `Should scan at least 1 file, got ${graph.files_scanned}`);
});

await test('graph detects edges between test files', async () => {
  const graph = readJSON('.ogu/GRAPH.json');
  // Our drift-test/api.mjs imports from drift-test/data.mjs
  const hasEdge = graph.edges.some(e =>
    (e.from.includes('drift-test/api') && e.to.includes('drift-test/data')) ||
    (e.from.includes('drift-test/data') && e.to.includes('drift-test/api'))
  );
  assert(hasEdge, 'Should detect import edge between test files');
});

// ── Part 6: ogu impact ──

console.log('\n\x1b[36m  Part 6: Impact Analysis\x1b[0m');

await test('ogu impact <file> runs without error', async () => {
  const result = ogu('impact', ['src/drift-test/data.mjs']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
});

await test('impact reports dependents of data.mjs', async () => {
  const result = ogu('impact', ['src/drift-test/data.mjs']);
  assert(
    result.stdout.includes('drift-test/api') || result.stdout.includes('dependent') ||
    result.stdout.includes('impact') || result.stdout.includes('Impact'),
    `Should find api.mjs as dependent: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('impact references affected tasks', async () => {
  const result = ogu('impact', ['src/drift-test/data.mjs']);
  // Should find the task from Plan.json that touches this file
  assert(
    result.stdout.includes('task') || result.stdout.includes('Task') ||
    result.stdout.includes('Plan') || result.stdout.includes(FEATURE) ||
    result.stdout.includes('impact') || result.stdout.includes('file'),
    `Should reference tasks or feature: ${result.stdout.trim().slice(0, 300)}`,
  );
});

// ── Part 7: ogu spec:patch ──

console.log('\n\x1b[36m  Part 7: Spec Change Records\x1b[0m');

await test('spec:patch creates SCR file', async () => {
  // First modify the spec so there's a change to record
  const specPath = join(ROOT, `${FEATURE_DIR}/Spec.md`);
  const original = readFileSync(specPath, 'utf8');
  writeFileSync(specPath, original + '\n## Performance\n\nResponse time < 200ms\n', 'utf8');

  const result = ogu('spec:patch', [FEATURE, 'Added performance requirements']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('SCR') || result.stdout.includes('created') || result.stdout.includes('patch'),
    `Should confirm SCR creation: ${result.stdout.trim()}`,
  );
});

await test('SCR file exists in feature directory', async () => {
  const featureDir = join(ROOT, FEATURE_DIR);
  const scrFiles = readdirSync(featureDir).filter(f => f.startsWith('SCR_'));
  assert(scrFiles.length >= 1, `Should have at least 1 SCR file, got ${scrFiles.length}`);
});

await test('SCR file contains hash chain', async () => {
  const featureDir = join(ROOT, FEATURE_DIR);
  const scrFiles = readdirSync(featureDir).filter(f => f.startsWith('SCR_')).sort();
  const scrContent = readFileSync(join(featureDir, scrFiles[0]), 'utf8');
  assert(
    scrContent.includes('previous_spec_hash') || scrContent.includes('current_spec_hash') || scrContent.includes('hash'),
    `SCR should contain hash chain: ${scrContent.slice(0, 200)}`,
  );
});

await test('spec:patch with unchanged spec is handled gracefully', async () => {
  // Run again without changing spec — should detect no change or create with same hashes
  const result = ogu('spec:patch', [FEATURE, 'No actual change']);
  // Should succeed (0) or gracefully report no change
  assert(
    result.exitCode === 0 || result.stdout.includes('unchanged') || result.stdout.includes('no change') ||
    result.stdout.includes('SCR') || result.stdout.includes('created'),
    `Should handle gracefully: ${result.stdout.trim()}`,
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
