#!/usr/bin/env node

/**
 * Slice 23 — Crypto Attestation + Error Recovery (Gap Closure P10 + P11)
 *
 * Proves: SHA-256 attestation for artifacts/envelopes, structured error
 *   recovery with retry strategies and DAG rewind.
 *
 * Tests:
 *   P10: crypto-attestation.mjs — sign/verify/chain attestations
 *   P11: error-recovery.mjs — classify errors, retry strategies, DAG rewind
 *
 * Depends on: Slices 1-22
 *
 * Run: node tests/e2e/slice-23.test.mjs
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
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
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

// ── Setup ──

function setup() {
  ogu('org:init', ['--force']);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 23 — Crypto Attestation + Error Recovery (P10 + P11)\x1b[0m\n');
console.log('  SHA-256 attestation, error classification, retry strategies, DAG rewind\n');

setup();

// ── Part 1: Crypto Attestation Library ──

console.log('\x1b[36m  Part 1: Crypto Attestation Library\x1b[0m');

await test('crypto-attestation.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/crypto-attestation.mjs');
  assert(typeof mod.createAttestation === 'function', 'Should export createAttestation');
  assert(typeof mod.verifyAttestation === 'function', 'Should export verifyAttestation');
  assert(typeof mod.hashContent === 'function', 'Should export hashContent');
  assert(typeof mod.buildChain === 'function', 'Should export buildChain');
});

await test('hashContent produces consistent SHA-256', async () => {
  const { hashContent } = await import('../../tools/ogu/commands/lib/crypto-attestation.mjs');
  const hash1 = hashContent('hello world');
  const hash2 = hashContent('hello world');
  assertEqual(hash1, hash2, 'Same content should produce same hash');
  assert(hash1.length === 64, `Hash should be 64 hex chars, got ${hash1.length}`);

  const hash3 = hashContent('different');
  assert(hash1 !== hash3, 'Different content should produce different hash');
});

await test('createAttestation signs content with metadata', async () => {
  const { createAttestation } = await import('../../tools/ogu/commands/lib/crypto-attestation.mjs');
  const att = createAttestation({
    type: 'artifact',
    taskId: 'task-1',
    featureSlug: 'test-crypto',
    content: JSON.stringify({ files: ['src/main.js'] }),
  });
  assert(att.hash, 'Should have hash');
  assert(att.timestamp, 'Should have timestamp');
  assert(att.type === 'artifact', 'Should have type');
  assert(att.taskId === 'task-1', 'Should have taskId');
  assert(att.signature, 'Should have signature');
});

await test('verifyAttestation validates correct attestation', async () => {
  const { createAttestation, verifyAttestation } = await import('../../tools/ogu/commands/lib/crypto-attestation.mjs');
  const content = JSON.stringify({ files: ['src/main.js'] });
  const att = createAttestation({
    type: 'artifact',
    taskId: 'task-1',
    featureSlug: 'test-crypto',
    content,
  });

  const valid = verifyAttestation(att, content);
  assert(valid.valid, `Should be valid: ${valid.reason || ''}`);
});

await test('verifyAttestation rejects tampered content', async () => {
  const { createAttestation, verifyAttestation } = await import('../../tools/ogu/commands/lib/crypto-attestation.mjs');
  const content = JSON.stringify({ files: ['src/main.js'] });
  const att = createAttestation({
    type: 'artifact',
    taskId: 'task-1',
    featureSlug: 'test-crypto',
    content,
  });

  const tampered = JSON.stringify({ files: ['src/HACKED.js'] });
  const invalid = verifyAttestation(att, tampered);
  assertEqual(invalid.valid, false, 'Tampered content should fail verification');
});

await test('buildChain creates linked attestation chain', async () => {
  const { createAttestation, buildChain } = await import('../../tools/ogu/commands/lib/crypto-attestation.mjs');

  const att1 = createAttestation({
    type: 'input',
    taskId: 'task-1',
    featureSlug: 'test-crypto',
    content: 'input-data',
  });

  const att2 = createAttestation({
    type: 'output',
    taskId: 'task-1',
    featureSlug: 'test-crypto',
    content: 'output-data',
    previousHash: att1.hash,
  });

  const chain = buildChain([att1, att2]);
  assert(chain.valid, 'Chain should be valid');
  assertEqual(chain.length, 2, 'Chain should have 2 links');
  assertEqual(chain.links[1].previousHash, att1.hash, 'Second link should reference first hash');
});

// ── Part 2: Attestation CLI ──

console.log('\n\x1b[36m  Part 2: Attestation CLI\x1b[0m');

await test('attest:create creates attestation for a file', async () => {
  // Create a test file to attest
  writeJSON('.ogu/artifacts/test-crypto/task-attest.json', {
    taskId: 'task-attest',
    files: [{ path: 'src/app.js', content: 'const app = {};' }],
  });

  const result = ogu('attest:create', ['--feature', 'test-crypto', '--task', 'task-attest']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Attestation') || result.stdout.includes('attestation') || result.stdout.includes('hash'),
    `Should show attestation: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('attest:verify validates existing attestation', async () => {
  const result = ogu('attest:verify', ['--feature', 'test-crypto', '--task', 'task-attest']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('valid') || result.stdout.includes('VALID') || result.stdout.includes('✓'),
    `Should report valid: ${result.stdout.trim().slice(0, 200)}`,
  );
});

// ── Part 3: Error Recovery Library ──

console.log('\n\x1b[36m  Part 3: Error Recovery Library\x1b[0m');

await test('error-recovery.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/error-recovery.mjs');
  assert(typeof mod.classifyError === 'function', 'Should export classifyError');
  assert(typeof mod.getRetryStrategy === 'function', 'Should export getRetryStrategy');
  assert(typeof mod.computeRewindPoint === 'function', 'Should export computeRewindPoint');
});

await test('classifyError categorizes common errors', async () => {
  const { classifyError } = await import('../../tools/ogu/commands/lib/error-recovery.mjs');

  const budget = classifyError({ code: 'OGU0401', message: 'Budget exceeded' });
  assertEqual(budget.category, 'budget', `Budget error should be "budget", got "${budget.category}"`);
  assert(budget.retryable === false, 'Budget errors should not be retryable');

  const transient = classifyError({ code: 'OGU0500', message: 'LLM timeout' });
  assertEqual(transient.category, 'transient', `Timeout should be "transient", got "${transient.category}"`);
  assert(transient.retryable === true, 'Transient errors should be retryable');

  const validation = classifyError({ code: 'OGU0301', message: 'Gate failed' });
  assertEqual(validation.category, 'validation', `Gate failure should be "validation", got "${validation.category}"`);
});

await test('getRetryStrategy returns appropriate strategy', async () => {
  const { getRetryStrategy } = await import('../../tools/ogu/commands/lib/error-recovery.mjs');

  const transientStrategy = getRetryStrategy('transient');
  assert(transientStrategy.maxRetries >= 1, 'Transient should allow retries');
  assert(transientStrategy.backoffMs > 0, 'Should have backoff');

  const budgetStrategy = getRetryStrategy('budget');
  assertEqual(budgetStrategy.maxRetries, 0, 'Budget should not retry');

  const escalation = getRetryStrategy('quality');
  assert(escalation.escalate === true, 'Quality errors should escalate to higher tier');
});

await test('computeRewindPoint finds correct DAG rewind target', async () => {
  const { computeRewindPoint } = await import('../../tools/ogu/commands/lib/error-recovery.mjs');

  const dag = {
    waves: [['setup-db', 'setup-api'], ['write-endpoints'], ['write-tests']],
    tasks: [
      { id: 'setup-db', dependsOn: [] },
      { id: 'setup-api', dependsOn: [] },
      { id: 'write-endpoints', dependsOn: ['setup-db', 'setup-api'] },
      { id: 'write-tests', dependsOn: ['write-endpoints'] },
    ],
  };

  // If write-tests fails, rewind to write-endpoints (its dependency)
  const rewind1 = computeRewindPoint('write-tests', dag);
  assertEqual(rewind1.rewindToWave, 1, 'Should rewind to wave 1 (write-endpoints)');
  assert(rewind1.tasksToRerun.includes('write-endpoints'), 'Should rerun write-endpoints');

  // If write-endpoints fails, rewind to wave 0 (its dependencies)
  const rewind2 = computeRewindPoint('write-endpoints', dag);
  assertEqual(rewind2.rewindToWave, 0, 'Should rewind to wave 0');
});

await test('computeRewindPoint handles root task failure', async () => {
  const { computeRewindPoint } = await import('../../tools/ogu/commands/lib/error-recovery.mjs');

  const dag = {
    waves: [['setup-db', 'setup-api'], ['write-endpoints']],
    tasks: [
      { id: 'setup-db', dependsOn: [] },
      { id: 'setup-api', dependsOn: [] },
      { id: 'write-endpoints', dependsOn: ['setup-db', 'setup-api'] },
    ],
  };

  // Root task failure — no rewind possible, just retry in place
  const rewind = computeRewindPoint('setup-db', dag);
  assertEqual(rewind.rewindToWave, 0, 'Root task should rewind to wave 0');
  assert(rewind.tasksToRerun.includes('setup-db'), 'Should rerun the failed root task');
});

// ── Part 4: Error Recovery CLI ──

console.log('\n\x1b[36m  Part 4: Error Recovery CLI\x1b[0m');

await test('recover:classify explains an error code', async () => {
  const result = ogu('recover:classify', ['--code', 'OGU0500']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('transient') || result.stdout.includes('Transient'),
    `Should classify: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('recover:strategy shows retry plan for error', async () => {
  const result = ogu('recover:strategy', ['--code', 'OGU0500']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('retry') || result.stdout.includes('Retry') || result.stdout.includes('backoff'),
    `Should show strategy: ${result.stdout.trim().slice(0, 200)}`,
  );
});

// ── Cleanup ──

const testArtifacts = join(ROOT, '.ogu/artifacts/test-crypto');
if (existsSync(testArtifacts)) rmSync(testArtifacts, { recursive: true });
const testAttestations = join(ROOT, '.ogu/attestations/test-crypto');
if (existsSync(testAttestations)) rmSync(testAttestations, { recursive: true });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
