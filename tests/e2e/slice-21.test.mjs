#!/usr/bin/env node

/**
 * Slice 21 — Artifact Store + Wave Execution (Gap Closure P6 + P7)
 *
 * Proves: Structured artifact passing between tasks, wave-based DAG execution.
 *
 * Tests:
 *   P6: artifact-store.mjs — store/load/list artifacts per task
 *   P7: agent-runtime.mjs — executeWave, executeDAG (dry-run)
 *
 * Depends on: Slices 1-20
 *
 * Run: node tests/e2e/slice-21.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
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
      cwd: ROOT, encoding: 'utf8', timeout: 30000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--force']);

  // Create test feature with DAG Plan
  const featureDir = 'docs/vault/features/test-wave';
  mkdirSync(join(ROOT, featureDir), { recursive: true });

  writeJSON(`${featureDir}/Plan.json`, {
    tasks: [
      {
        id: 'setup-db',
        name: 'Setup database schema',
        description: 'Create database tables',
        dependsOn: [],
        requiredCapabilities: ['code_generation'],
        riskTier: 'medium',
        output: { files: [{ path: 'db/schema.sql', content: 'CREATE TABLE users;' }] },
      },
      {
        id: 'setup-api',
        name: 'Setup API framework',
        description: 'Create API boilerplate',
        dependsOn: [],
        requiredCapabilities: ['code_generation'],
        riskTier: 'medium',
        output: { files: [{ path: 'server/app.js', content: '// api app' }] },
      },
      {
        id: 'write-endpoints',
        name: 'Write API endpoints',
        description: 'Create REST endpoints using DB schema and API framework',
        dependsOn: ['setup-db', 'setup-api'],
        requiredCapabilities: ['code_generation'],
        riskTier: 'medium',
        output: { files: [{ path: 'server/routes.js', content: '// routes' }] },
      },
      {
        id: 'write-tests',
        name: 'Write tests',
        description: 'Test the endpoints',
        dependsOn: ['write-endpoints'],
        requiredCapabilities: ['testing'],
        riskTier: 'medium',
        output: { files: [{ path: 'tests/api.test.js', content: '// tests' }] },
      },
    ],
  });

  // Clean up any previous artifacts
  const artifactDir = join(ROOT, '.ogu/artifacts');
  if (existsSync(artifactDir)) rmSync(artifactDir, { recursive: true });
}

// ── Tests ──

console.log('\n\x1b[1mSlice 21 — Artifact Store + Wave Execution (P6 + P7)\x1b[0m\n');
console.log('  Artifact passing between tasks, DAG wave execution\n');

setup();

// ── Part 1: Artifact Store Library ──

console.log('\x1b[36m  Part 1: Artifact Store Library\x1b[0m');

await test('artifact-store.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/artifact-store.mjs');
  assert(typeof mod.storeArtifact === 'function', 'Should export storeArtifact');
  assert(typeof mod.loadArtifacts === 'function', 'Should export loadArtifacts');
  assert(typeof mod.listArtifacts === 'function', 'Should export listArtifacts');
});

await test('storeArtifact saves task output', async () => {
  const { storeArtifact } = await import('../../tools/ogu/commands/lib/artifact-store.mjs');
  storeArtifact('setup-db', 'test-wave', {
    files: [{ path: 'db/schema.sql', content: 'CREATE TABLE users (id INT);' }],
    metadata: { rows: 1 },
  });
  assert(fileExists('.ogu/artifacts/test-wave/setup-db.json'), 'Artifact file should exist');
});

await test('loadArtifacts retrieves stored artifacts', async () => {
  const { loadArtifacts } = await import('../../tools/ogu/commands/lib/artifact-store.mjs');
  const artifacts = loadArtifacts('setup-db', 'test-wave');
  assert(artifacts, 'Should return artifacts');
  assert(artifacts.files?.length === 1, `Should have 1 file, got ${artifacts.files?.length}`);
  assertEqual(artifacts.files[0].path, 'db/schema.sql', 'Should have correct file path');
});

await test('loadArtifacts returns null for missing task', async () => {
  const { loadArtifacts } = await import('../../tools/ogu/commands/lib/artifact-store.mjs');
  const result = loadArtifacts('nonexistent-task', 'test-wave');
  assertEqual(result, null, 'Should return null for missing artifact');
});

await test('listArtifacts shows all stored artifacts for a feature', async () => {
  const { storeArtifact, listArtifacts } = await import('../../tools/ogu/commands/lib/artifact-store.mjs');
  // Store another artifact
  storeArtifact('setup-api', 'test-wave', {
    files: [{ path: 'server/app.js', content: 'const express = require("express");' }],
  });
  const list = listArtifacts('test-wave');
  assert(Array.isArray(list), 'Should return array');
  assert(list.length >= 2, `Should have at least 2 artifacts, got ${list.length}`);
  assert(list.includes('setup-db'), 'Should include setup-db');
  assert(list.includes('setup-api'), 'Should include setup-api');
});

// ── Part 2: Artifact Store CLI ──

console.log('\n\x1b[36m  Part 2: Artifact Store CLI\x1b[0m');

await test('artifact:list shows stored artifacts', async () => {
  const result = ogu('artifact:list', ['--feature', 'test-wave']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('setup-db') && result.stdout.includes('setup-api'),
    `Should list artifacts: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('artifact:get retrieves artifact data', async () => {
  const result = ogu('artifact:get', ['--feature', 'test-wave', '--task', 'setup-db', '--json']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  const artifact = JSON.parse(result.stdout.trim());
  assert(artifact.files, 'Should have files');
  assert(artifact.files.length === 1, 'Should have 1 file');
});

// ── Part 3: Wave Execution — Agent Runtime Library ──

console.log('\n\x1b[36m  Part 3: Agent Runtime Library\x1b[0m');

await test('agent-runtime.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/agent-runtime.mjs');
  assert(typeof mod.executeWave === 'function', 'Should export executeWave');
  assert(typeof mod.executeDAG === 'function', 'Should export executeDAG');
});

await test('executeDAG builds correct wave order', async () => {
  const { executeDAG } = await import('../../tools/ogu/commands/lib/agent-runtime.mjs');
  const plan = readJSON('docs/vault/features/test-wave/Plan.json');
  const result = await executeDAG({
    featureSlug: 'test-wave',
    tasks: plan.tasks,
    dryRun: true,
  });
  assert(result, 'Should return result');
  assert(result.waves, 'Should have waves');
  assert(result.waves.length >= 2, `Should have at least 2 waves (parallel roots + dependents), got ${result.waves.length}`);
  // Wave 0 should have the two root tasks
  assert(result.waves[0].length === 2, `Wave 0 should have 2 parallel tasks, got ${result.waves[0].length}`);
});

await test('executeDAG respects dependencies', async () => {
  const { executeDAG } = await import('../../tools/ogu/commands/lib/agent-runtime.mjs');
  const plan = readJSON('docs/vault/features/test-wave/Plan.json');
  const result = await executeDAG({
    featureSlug: 'test-wave',
    tasks: plan.tasks,
    dryRun: true,
  });

  // write-endpoints depends on both roots, should be in wave 1+
  const flatWave0 = result.waves[0];
  assert(!flatWave0.includes('write-endpoints'), 'write-endpoints should NOT be in wave 0');
  assert(!flatWave0.includes('write-tests'), 'write-tests should NOT be in wave 0');

  // write-tests depends on write-endpoints, should be last wave
  const lastWave = result.waves[result.waves.length - 1];
  assert(lastWave.includes('write-tests'), 'write-tests should be in the last wave');
});

await test('executeDAG allocates agents per task', async () => {
  const { executeDAG } = await import('../../tools/ogu/commands/lib/agent-runtime.mjs');
  const plan = readJSON('docs/vault/features/test-wave/Plan.json');
  const result = await executeDAG({
    featureSlug: 'test-wave',
    tasks: plan.tasks,
    dryRun: true,
  });
  assert(result.allocations, 'Should have allocations');
  assert(result.allocations.length === plan.tasks.length, `Should allocate all ${plan.tasks.length} tasks`);
  for (const alloc of result.allocations) {
    assert(alloc.roleId, `Task ${alloc.taskId} should have assigned role`);
  }
});

await test('executeWave processes a single wave of tasks', async () => {
  const { executeWave } = await import('../../tools/ogu/commands/lib/agent-runtime.mjs');
  const result = await executeWave({
    waveIndex: 0,
    taskIds: ['setup-db', 'setup-api'],
    featureSlug: 'test-wave',
    allocations: [
      { taskId: 'setup-db', roleId: 'backend-dev' },
      { taskId: 'setup-api', roleId: 'backend-dev' },
    ],
    dryRun: true,
  });
  assert(result, 'Should return result');
  assert(result.completed, 'Should have completed list');
  assertEqual(result.completed.length, 2, `Should complete 2 tasks, got ${result.completed.length}`);
});

// ── Part 4: Wave Execution CLI ──

console.log('\n\x1b[36m  Part 4: Wave Execution CLI\x1b[0m');

await test('wave:run --feature executes DAG in dry-run', async () => {
  const result = ogu('wave:run', ['--feature', 'test-wave', '--dry-run']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Wave') || result.stdout.includes('wave'),
    `Should show wave execution: ${result.stdout.trim().slice(0, 300)}`,
  );
  assert(
    result.stdout.includes('setup-db') || result.stdout.includes('setup-api'),
    `Should show task names: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('wave:run shows completion summary', async () => {
  const result = ogu('wave:run', ['--feature', 'test-wave', '--dry-run']);
  assertEqual(result.exitCode, 0, 'Should succeed');
  assert(
    result.stdout.includes('4') || result.stdout.includes('completed') || result.stdout.includes('Done'),
    `Should show completion: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('wave:run --json returns structured result', async () => {
  const result = ogu('wave:run', ['--feature', 'test-wave', '--dry-run', '--json']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  const data = JSON.parse(result.stdout.trim());
  assert(data.waves, 'Should have waves');
  assert(data.allocations, 'Should have allocations');
  assert(data.completed !== undefined || data.tasksCompleted !== undefined, 'Should have completion count');
});

await test('wave:run requires --feature', async () => {
  const result = ogu('wave:run', []);
  assertEqual(result.exitCode, 1, 'Should fail without --feature');
});

// ── Cleanup ──

const testFeature = join(ROOT, 'docs/vault/features/test-wave');
if (existsSync(testFeature)) rmSync(testFeature, { recursive: true });
const artifactDir = join(ROOT, '.ogu/artifacts/test-wave');
if (existsSync(artifactDir)) rmSync(artifactDir, { recursive: true });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
