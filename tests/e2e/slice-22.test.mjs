#!/usr/bin/env node

/**
 * Slice 22 — Semantic File Locking + Governance Enforcement (Gap Closure P8 + P9)
 *
 * Proves: File-level locking for concurrent agents, governance integration
 *   with wave execution and cross-boundary detection.
 *
 * Tests:
 *   P8: file-lock.mjs — acquire/release/check/list locks
 *   P9: governance integration — rules management, wave+governance
 *
 * Depends on: Slices 1-21
 *
 * Run: node tests/e2e/slice-22.test.mjs
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

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--force']);

  // Clean locks
  const locksDir = join(ROOT, '.ogu/locks');
  if (existsSync(locksDir)) rmSync(locksDir, { recursive: true });
}

// ── Tests ──

console.log('\n\x1b[1mSlice 22 — Semantic File Locking + Governance Enforcement (P8 + P9)\x1b[0m\n');
console.log('  File-level locks, governance rules management, cross-boundary detection\n');

setup();

// ── Part 1: File Lock Library ──

console.log('\x1b[36m  Part 1: File Lock Library\x1b[0m');

await test('file-lock.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/file-lock.mjs');
  assert(typeof mod.acquireLock === 'function', 'Should export acquireLock');
  assert(typeof mod.releaseLock === 'function', 'Should export releaseLock');
  assert(typeof mod.checkLock === 'function', 'Should export checkLock');
  assert(typeof mod.listLocks === 'function', 'Should export listLocks');
});

await test('acquireLock creates lock for file paths', async () => {
  const { acquireLock } = await import('../../tools/ogu/commands/lib/file-lock.mjs');
  const result = acquireLock({
    files: ['src/main.js', 'src/utils.js'],
    roleId: 'developer',
    taskId: 'task-1',
  });
  assert(result.acquired, `Should acquire lock: ${result.reason || ''}`);
  assert(result.lockId, 'Should return lockId');
});

await test('acquireLock rejects conflict on same file', async () => {
  const { acquireLock } = await import('../../tools/ogu/commands/lib/file-lock.mjs');
  const result = acquireLock({
    files: ['src/main.js'],
    roleId: 'qa',
    taskId: 'task-2',
  });
  assertEqual(result.acquired, false, 'Should reject conflicting lock');
  assert(
    result.reason?.includes('task-1') || result.reason?.includes('locked') || result.reason?.includes('conflict'),
    `Should explain conflict: ${result.reason}`,
  );
});

await test('acquireLock allows non-conflicting files', async () => {
  const { acquireLock } = await import('../../tools/ogu/commands/lib/file-lock.mjs');
  const result = acquireLock({
    files: ['tests/main.test.js'],
    roleId: 'qa',
    taskId: 'task-3',
  });
  assert(result.acquired, 'Should acquire lock for non-conflicting files');
});

await test('checkLock reports lock status for a file', async () => {
  const { checkLock } = await import('../../tools/ogu/commands/lib/file-lock.mjs');
  const locked = checkLock('src/main.js');
  assert(locked, 'src/main.js should be locked');
  assertEqual(locked.taskId, 'task-1', 'Should be locked by task-1');

  const unlocked = checkLock('some/other/file.js');
  assertEqual(unlocked, null, 'Unlocked file should return null');
});

await test('listLocks shows all active locks', async () => {
  const { listLocks } = await import('../../tools/ogu/commands/lib/file-lock.mjs');
  const locks = listLocks();
  assert(locks.length >= 2, `Should have at least 2 locks, got ${locks.length}`);
});

await test('releaseLock frees locked files', async () => {
  const { releaseLock, checkLock } = await import('../../tools/ogu/commands/lib/file-lock.mjs');
  releaseLock('task-1');
  const result = checkLock('src/main.js');
  assertEqual(result, null, 'src/main.js should be unlocked after release');
});

// ── Part 2: File Lock CLI ──

console.log('\n\x1b[36m  Part 2: File Lock CLI\x1b[0m');

await test('lock:acquire creates lock via CLI', async () => {
  const result = ogu('lock:acquire', ['--task', 'cli-task-1', '--files', 'api/routes.js,api/db.js', '--role', 'backend-dev']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Acquired') || result.stdout.includes('acquired') || result.stdout.includes('lock'),
    `Should confirm: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('lock:list shows active locks', async () => {
  const result = ogu('lock:list');
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('cli-task-1') || result.stdout.includes('api/routes.js'),
    `Should show lock: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('lock:release frees lock via CLI', async () => {
  const result = ogu('lock:release', ['--task', 'cli-task-1']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
});

// ── Part 3: Governance Rules Management ──

console.log('\n\x1b[36m  Part 3: Governance Rules Management\x1b[0m');

await test('governance:check with policy rules works', async () => {
  // Always write test policy rules
  {
    writeJSON('.ogu/policies/rules.json', {
      version: 1,
      rules: [
        {
          id: 'require-approval-critical',
          name: 'Require approval for critical risk',
          enabled: true,
          priority: 100,
          when: { field: 'task.riskTier', op: 'eq', value: 'critical' },
          then: [{ effect: 'requireApprovals', params: { count: 1, fromRoles: ['tech-lead'] } }],
        },
        {
          id: 'deny-production-direct',
          name: 'Deny direct production changes',
          enabled: true,
          priority: 200,
          when: { field: 'task.touches', op: 'matches_any', value: ['production/**', 'deploy/**'] },
          then: [{ effect: 'deny', params: { reason: 'Direct production changes are not allowed' } }],
        },
      ],
    });
  }

  const result = ogu('governance:check', [
    '--feature', 'test-gov',
    '--task', 'write-code',
    '--risk', 'low',
  ]);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('ALLOW'),
    `Low risk should be allowed: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('governance:check blocks critical without approval', async () => {
  const result = ogu('governance:check', [
    '--feature', 'test-gov',
    '--task', 'critical-task',
    '--risk', 'critical',
    '--json',
  ]);
  assertEqual(result.exitCode, 0, 'Should succeed (returns decision, not exit code)');
  const check = JSON.parse(result.stdout.trim());
  assertEqual(check.decision, 'REQUIRES_APPROVAL', `Critical risk should require approval, got ${check.decision}`);
});

await test('governance:check denies production touches', async () => {
  const result = ogu('governance:check', [
    '--feature', 'test-gov',
    '--task', 'deploy-prod',
    '--risk', 'high',
    '--touches', 'production/config.yaml',
    '--json',
  ]);
  assertEqual(result.exitCode, 0, 'Should succeed');
  const check = JSON.parse(result.stdout.trim());
  assertEqual(check.decision, 'DENY', `Production touches should be denied, got ${check.decision}`);
});

await test('approve + re-check allows previously blocked task', async () => {
  // First approve
  ogu('approve', [
    '--feature', 'test-gov',
    '--task', 'critical-task',
    '--role', 'tech-lead',
    '--by', 'admin',
    '--reason', 'Reviewed and approved',
  ]);

  // Re-check should now allow
  const result = ogu('governance:check', [
    '--feature', 'test-gov',
    '--task', 'critical-task',
    '--risk', 'critical',
    '--json',
  ]);
  const check = JSON.parse(result.stdout.trim());
  assertEqual(check.decision, 'ALLOW', `Should be allowed after approval, got ${check.decision}`);
});

// ── Part 4: Cross-Boundary Detection ──

console.log('\n\x1b[36m  Part 4: Cross-Boundary Detection\x1b[0m');

await test('governance detects cross-boundary file access', async () => {
  // Add a rule that detects cross-boundary access
  const rules = readJSON('.ogu/policies/rules.json');
  rules.rules.push({
    id: 'cross-boundary-alert',
    name: 'Alert on cross-boundary access',
    enabled: true,
    priority: 50,
    when: { field: 'task.touches', op: 'matches_any', value: ['.env*', '.ogu/audit/**', 'secrets/**'] },
    then: [{ effect: 'requireApprovals', params: { count: 1, fromRoles: ['security'] } }],
  });
  writeJSON('.ogu/policies/rules.json', rules);

  const result = ogu('governance:check', [
    '--feature', 'test-gov',
    '--task', 'read-secrets',
    '--risk', 'medium',
    '--touches', '.env.local',
    '--json',
  ]);
  const check = JSON.parse(result.stdout.trim());
  assertEqual(check.decision, 'REQUIRES_APPROVAL', `Touching .env should require approval, got ${check.decision}`);
});

// ── Cleanup ──

const locksDir = join(ROOT, '.ogu/locks');
if (existsSync(locksDir)) rmSync(locksDir, { recursive: true });
const approvalsDir = join(ROOT, '.ogu/approvals');
if (existsSync(approvalsDir)) rmSync(approvalsDir, { recursive: true });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
