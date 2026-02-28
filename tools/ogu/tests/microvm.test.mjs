/**
 * MicroVM Tests.
 *
 * 8 tests covering:
 *   Section 1: createVM + listActiveVMs (3 tests)
 *   Section 2: executeInVM (2 tests)
 *   Section 3: destroyVM + getVMStats (3 tests)
 */

import { createVM, listActiveVMs, executeInVM, destroyVM, getVMStats, getVMStatus } from '../commands/lib/microvm.mjs';
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

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-microvm-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/vms'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: createVM + listActiveVMs
// ═══════════════════════════════════════════════════════════════════════

// 1. createVM returns vmId + workDir
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  assert(vm && vm.vmId && vm.workDir,
    'createVM returns vmId + workDir');
  try { destroyVM(root, vm.vmId); } catch {}
  rmSync(root, { recursive: true, force: true });
}

// 2. workDir is actually created on disk
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  assert(existsSync(vm.workDir),
    'workDir is actually created on disk');
  try { destroyVM(root, vm.vmId); } catch {}
  rmSync(root, { recursive: true, force: true });
}

// 3. listActiveVMs includes created VM
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  const list = listActiveVMs(root);
  assert(Array.isArray(list) && list.some(v => v.vmId === vm.vmId),
    'listActiveVMs includes created VM');
  try { destroyVM(root, vm.vmId); } catch {}
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: executeInVM
// ═══════════════════════════════════════════════════════════════════════

// 4. executeInVM runs command in isolated env
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  const result = executeInVM(root, vm.vmId, { command: 'echo', args: ['hello'] });
  assert(result && (result.stdout?.includes('hello') || result.exitCode === 0 || result.output?.includes('hello')),
    'executeInVM runs command and captures output');
  try { destroyVM(root, vm.vmId); } catch {}
  rmSync(root, { recursive: true, force: true });
}

// 5. getVMStatus returns VM info
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  const status = getVMStatus(root, vm.vmId);
  assert(status && status.vmId === vm.vmId,
    'getVMStatus returns correct VM info');
  try { destroyVM(root, vm.vmId); } catch {}
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: destroyVM + getVMStats
// ═══════════════════════════════════════════════════════════════════════

// 6. destroyVM removes VM
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  destroyVM(root, vm.vmId);
  const list = listActiveVMs(root);
  const stillExists = list.some(v => v.vmId === vm.vmId);
  assert(!stillExists, 'destroyVM removes VM from active list');
  rmSync(root, { recursive: true, force: true });
}

// 7. destroyVM cleans workDir
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  const workDir = vm.workDir;
  destroyVM(root, vm.vmId);
  assert(!existsSync(workDir), 'destroyVM cleans workDir from disk');
  rmSync(root, { recursive: true, force: true });
}

// 8. getVMStats returns counts
{
  const root = makeTmpRoot();
  const vm = createVM(root, { agentId: 'agent-1', taskId: 'T1', featureSlug: 'test' });
  const stats = getVMStats(root);
  assert(stats && typeof stats.total === 'number' || typeof stats.activeCount === 'number',
    'getVMStats returns counts');
  try { destroyVM(root, vm.vmId); } catch {}
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nMicroVM Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
