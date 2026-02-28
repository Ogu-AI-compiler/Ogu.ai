/**
 * Worker Tests.
 *
 * 8 tests covering:
 *   Section 1: createWorker (2 tests)
 *   Section 2: execute tasks (3 tests)
 *   Section 3: kill + drain (3 tests)
 */

import { createWorker, executeTask, workerStatus, drainWorker } from '../../runner/worker.mjs';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
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

function makeTmpWorkDir() {
  const dir = join(tmpdir(), `ogu-worker-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: createWorker
// ═══════════════════════════════════════════════════════════════════════

// 1. createWorker returns workerId + execute function
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir });
  assert(worker && worker.workerId && typeof worker.execute === 'function',
    'createWorker returns workerId + execute function');
  rmSync(workDir, { recursive: true, force: true });
}

// 2. Initial status is idle
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir });
  const s = worker.status();
  assert(s.state === 'idle', 'Initial worker status is idle');
  rmSync(workDir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: execute tasks
// ═══════════════════════════════════════════════════════════════════════

// 3. Execute noop task returns success
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir });
  const result = await worker.execute({ taskId: 'T1', command: 'noop', payload: {} });
  assert(result && result.status === 'success', 'Execute noop task returns success');
  rmSync(workDir, { recursive: true, force: true });
}

// 4. Execute with timeout returns error
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir });
  // Execute a long-running command with very short timeout
  const result = await worker.execute(
    { taskId: 'T2', command: 'exec', payload: { cmd: 'sleep 10' } },
    100 // 100ms timeout
  );
  assert(result && (result.status === 'error' || result.error),
    'Execute with timeout returns error');
  rmSync(workDir, { recursive: true, force: true });
}

// 5. workerStatus returns correct state
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir, name: 'test-worker' });
  const s = workerStatus(worker);
  assert(s.state === 'idle' && s.name === 'test-worker',
    'workerStatus returns correct state and name');
  rmSync(workDir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: kill + drain
// ═══════════════════════════════════════════════════════════════════════

// 6. kill() sets state to killed
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir });
  const killResult = worker.kill();
  assert(killResult.state === 'killed', 'kill() sets state to killed');
  rmSync(workDir, { recursive: true, force: true });
}

// 7. After kill, execute returns error
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir });
  worker.kill();
  const result = await worker.execute({ taskId: 'T3', command: 'noop', payload: {} });
  assert(result && result.status === 'error',
    'After kill, execute returns error');
  rmSync(workDir, { recursive: true, force: true });
}

// 8. drain() rejects new tasks
{
  const workDir = makeTmpWorkDir();
  const worker = createWorker({ workDir });
  const drainResult = await worker.drain(1000);
  assert(drainResult && drainResult.drained === true,
    'drain() completes and rejects new tasks');
  // Verify new tasks are rejected
  const result = await worker.execute({ taskId: 'T4', command: 'noop', payload: {} });
  assert(result && (result.status === 'error' || result.status === 'rejected'),
    'After drain, new tasks are rejected');
  rmSync(workDir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nWorker Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
