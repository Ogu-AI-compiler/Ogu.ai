/**
 * MicroVM CLI Commands — create, allocate, and destroy sandboxed execution environments.
 *
 * microvm:create --task <taskId> --isolation <level> [--role <roleId>] [--memory N] [--cpu N] [--timeout N]
 * microvm:allocate --task <taskId> [--isolation <level>]
 * microvm:destroy --vm <vmId>
 */

import { createVMSpec, createExecutionMatrix, validateResourceQuota, ISOLATION_LEVELS } from './lib/microvm-matrix.mjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { task: null, isolation: 'process', role: null, vm: null, memory: null, cpu: null, timeout: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) { result.task = args[++i]; continue; }
    if (args[i] === '--isolation' && args[i + 1]) { result.isolation = args[++i]; continue; }
    if (args[i] === '--role' && args[i + 1]) { result.role = args[++i]; continue; }
    if (args[i] === '--vm' && args[i + 1]) { result.vm = args[++i]; continue; }
    if (args[i] === '--memory' && args[i + 1]) { result.memory = parseInt(args[++i], 10); continue; }
    if (args[i] === '--cpu' && args[i + 1]) { result.cpu = parseInt(args[++i], 10); continue; }
    if (args[i] === '--timeout' && args[i + 1]) { result.timeout = parseInt(args[++i], 10); continue; }
    if (args[i] === '--json') { result.json = true; continue; }
  }
  return result;
}

function ensureVMDir(root) {
  const dir = join(root, '.ogu/vms');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function saveVM(root, vm) {
  const dir = ensureVMDir(root);
  writeFileSync(join(dir, `${vm.id}.json`), JSON.stringify(vm, null, 2));
}

/**
 * ogu microvm:create --task <taskId> --isolation <level> [--role <roleId>] [--memory N] [--cpu N] [--timeout N]
 *
 * Create a MicroVM sandbox specification for a task.
 */
export async function microvmCreate() {
  const root = repoRoot();
  const { task, isolation, role, memory, cpu, timeout, json } = parseArgs();

  if (!task) {
    console.error('Usage: ogu microvm:create --task <taskId> --isolation <level> [--role <roleId>]');
    return 1;
  }

  if (!ISOLATION_LEVELS[isolation]) {
    console.error(`Unknown isolation level: ${isolation}`);
    console.error(`Available: ${Object.keys(ISOLATION_LEVELS).join(', ')}`);
    return 1;
  }

  const resources = {};
  if (memory) resources.maxMemoryMB = memory;
  if (cpu) resources.maxCpuPercent = cpu;
  if (timeout) resources.timeoutMs = timeout;

  const vm = createVMSpec({
    taskId: task,
    roleId: role || 'unknown',
    isolation,
    resources: Object.keys(resources).length > 0 ? resources : undefined,
  });

  saveVM(root, vm);

  if (json) {
    console.log(JSON.stringify(vm, null, 2));
    return 0;
  }

  console.log('MICROVM CREATED');
  console.log('');
  console.log(`  VM ID:      ${vm.id}`);
  console.log(`  Task:       ${vm.taskId}`);
  console.log(`  Role:       ${vm.roleId}`);
  console.log(`  Isolation:  ${vm.isolation} — ${ISOLATION_LEVELS[vm.isolation].description}`);
  console.log(`  Security:   ${vm.security}`);
  console.log('');
  console.log('  RESOURCES:');
  console.log(`    Memory:   ${vm.resources.maxMemoryMB} MB`);
  console.log(`    CPU:      ${vm.resources.maxCpuPercent}%`);
  console.log(`    Timeout:  ${vm.resources.timeoutMs} ms`);
  console.log(`    Overhead: ${vm.overhead} MB`);
  console.log('');
  console.log(`  Created: ${vm.createdAt}`);
  return 0;
}

/**
 * ogu microvm:allocate --task <taskId> [--isolation <level>]
 *
 * Allocate resources for a MicroVM, validating against system limits.
 */
export async function microvmAllocate() {
  const root = repoRoot();
  const { task, isolation, json } = parseArgs();

  if (!task) {
    console.error('Usage: ogu microvm:allocate --task <taskId> [--isolation <level>]');
    return 1;
  }

  // Create the VM spec
  const vm = createVMSpec({
    taskId: task,
    roleId: 'allocator',
    isolation: isolation || 'process',
  });

  // System limits (defaults — could be read from config)
  const systemLimits = { totalMemoryMB: 8192, totalCpuPercent: 400 };
  const currentUsage = { memoryMB: 0, cpuPercent: 0 };

  // Read current usage from existing VMs
  const vmDir = join(root, '.ogu/vms');
  if (existsSync(vmDir)) {
    const { readdirSync } = await import('node:fs');
    const vmFiles = readdirSync(vmDir).filter(f => f.endsWith('.json') && f !== 'matrix.json');
    for (const f of vmFiles) {
      try {
        const existing = JSON.parse(readFileSync(join(vmDir, f), 'utf8'));
        if (existing.resources) {
          currentUsage.memoryMB += (existing.resources.maxMemoryMB || 0) + (existing.overhead || 0);
          currentUsage.cpuPercent += existing.resources.maxCpuPercent || 0;
        }
      } catch { /* skip */ }
    }
  }

  const quota = validateResourceQuota({
    requested: { maxMemoryMB: vm.resources.maxMemoryMB + vm.overhead, maxCpuPercent: vm.resources.maxCpuPercent },
    systemLimits,
    currentUsage,
  });

  if (json) {
    console.log(JSON.stringify({ vm, quota }, null, 2));
    return quota.allowed ? 0 : 1;
  }

  if (quota.allowed) {
    saveVM(root, vm);
    console.log('MICROVM ALLOCATED');
    console.log('');
    console.log(`  VM ID:     ${vm.id}`);
    console.log(`  Task:      ${task}`);
    console.log(`  Isolation: ${vm.isolation}`);
    console.log('');
    console.log('  ALLOCATION:');
    console.log(`    Memory:    ${vm.resources.maxMemoryMB} + ${vm.overhead} MB overhead`);
    console.log(`    CPU:       ${vm.resources.maxCpuPercent}%`);
    console.log(`    Available: ${quota.available.memoryMB} MB memory, ${quota.available.cpuPercent}% CPU remaining`);
  } else {
    console.error('ALLOCATION DENIED');
    console.error('');
    console.error(`  Task:   ${task}`);
    console.error(`  Reason: ${quota.reason}`);
    console.error(`  Available: ${quota.available.memoryMB} MB memory, ${quota.available.cpuPercent}% CPU`);
  }

  return quota.allowed ? 0 : 1;
}

/**
 * ogu microvm:destroy --vm <vmId>
 *
 * Destroy a MicroVM sandbox and release its resources.
 */
export async function microvmDestroy() {
  const root = repoRoot();
  const { vm: vmId, json } = parseArgs();

  if (!vmId) {
    console.error('Usage: ogu microvm:destroy --vm <vmId>');
    return 1;
  }

  const vmDir = join(root, '.ogu/vms');
  const vmPath = join(vmDir, `${vmId}.json`);

  if (!existsSync(vmPath)) {
    console.error(`VM not found: ${vmId}`);
    return 1;
  }

  const vm = JSON.parse(readFileSync(vmPath, 'utf8'));

  // Remove VM file
  const { unlinkSync } = await import('node:fs');
  unlinkSync(vmPath);

  if (json) {
    console.log(JSON.stringify({ destroyed: true, vmId, taskId: vm.taskId, resources: vm.resources }, null, 2));
    return 0;
  }

  console.log('MICROVM DESTROYED');
  console.log('');
  console.log(`  VM ID:     ${vmId}`);
  console.log(`  Task:      ${vm.taskId}`);
  console.log(`  Isolation: ${vm.isolation}`);
  console.log(`  Released:  ${vm.resources.maxMemoryMB + vm.overhead} MB memory, ${vm.resources.maxCpuPercent}% CPU`);
  return 0;
}
