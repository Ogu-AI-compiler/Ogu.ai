/**
 * Semantic Lock Tests.
 *
 * 8 tests covering:
 *   Section 1: acquireSemanticLock (2 tests)
 *   Section 2: releaseSemanticLock (2 tests)
 *   Section 3: predictConflicts (2 tests)
 *   Section 4: cleanStaleLocks (2 tests)
 */

import {
  acquireSemanticLock, releaseSemanticLock, getActiveLocks,
  predictConflicts, cleanStaleLocks,
} from '../commands/lib/semantic-lock.mjs';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-semlock-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/locks'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  // Create a dummy source file to lock
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src/app.ts'), 'export const app = true;', 'utf8');
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: acquireSemanticLock
// ═══════════════════════════════════════════════════════════════════════

// 1. Acquire lock succeeds on free file
{
  const root = makeTmpRoot();
  const result = acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  assert(result && result.lockId && result.acquired === true,
    'acquireSemanticLock succeeds on free file');
  rmSync(root, { recursive: true, force: true });
}

// 2. Second lock on same file by different agent fails
{
  const root = makeTmpRoot();
  acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  const second = acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-2',
    taskId: 'T2',
    featureSlug: 'test',
  });
  assert(second && second.acquired === false,
    'Second lock on same file by different agent fails');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: releaseSemanticLock
// ═══════════════════════════════════════════════════════════════════════

// 3. releaseSemanticLock frees the file
{
  const root = makeTmpRoot();
  const lock = acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  const released = releaseSemanticLock(root, lock.lockId);
  assert(released && released.released === true,
    'releaseSemanticLock frees the file');
  rmSync(root, { recursive: true, force: true });
}

// 4. After release, new agent can acquire
{
  const root = makeTmpRoot();
  const lock = acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  releaseSemanticLock(root, lock.lockId);
  const newLock = acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-2',
    taskId: 'T2',
    featureSlug: 'test',
  });
  assert(newLock && newLock.acquired === true,
    'After release, new agent can acquire lock');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: predictConflicts
// ═══════════════════════════════════════════════════════════════════════

// 5. predictConflicts detects overlapping locks
{
  const root = makeTmpRoot();
  acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  const locks = getActiveLocks(root);
  const prediction = predictConflicts(root, {
    files: ['src/app.ts'],
    currentLocks: locks,
  });
  // predictConflicts returns the conflicts array directly
  assert(Array.isArray(prediction) && prediction.length > 0,
    'predictConflicts detects overlapping locks');
  rmSync(root, { recursive: true, force: true });
}

// 6. predictConflicts reports no conflicts on free files
{
  const root = makeTmpRoot();
  writeFileSync(join(root, 'src/other.ts'), 'export const other = true;', 'utf8');
  acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  const locks = getActiveLocks(root);
  const prediction = predictConflicts(root, {
    files: ['src/other.ts'],
    currentLocks: locks,
  });
  assert(Array.isArray(prediction) && prediction.length === 0,
    'predictConflicts reports no conflicts on free files');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: cleanStaleLocks
// ═══════════════════════════════════════════════════════════════════════

// 7. cleanStaleLocks removes expired locks
{
  const root = makeTmpRoot();
  acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  // Clean with very short maxAge to force stale
  const cleaned = cleanStaleLocks(root, { maxAgeMs: 0 });
  assert(cleaned && typeof cleaned.cleaned === 'number',
    'cleanStaleLocks returns removal count');
  rmSync(root, { recursive: true, force: true });
}

// 8. getActiveLocks returns locks
{
  const root = makeTmpRoot();
  acquireSemanticLock(root, {
    files: ['src/app.ts'],
    agentId: 'agent-1',
    taskId: 'T1',
    featureSlug: 'test',
  });
  const locks = getActiveLocks(root);
  assert(Array.isArray(locks) && locks.length >= 1,
    'getActiveLocks returns active locks');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nSemantic Lock Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
