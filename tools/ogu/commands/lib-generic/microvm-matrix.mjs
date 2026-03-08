import { randomUUID } from 'node:crypto';

/**
 * MicroVM Execution Matrix — isolation planning with resource quotas.
 *
 * Plans execution environments for concurrent agents.
 * Supports multiple isolation levels from none (in-process) to container.
 */

/**
 * Isolation level definitions.
 */
export const ISOLATION_LEVELS = {
  none: {
    description: 'No isolation — runs in same process',
    overhead: 0,
    security: 'low',
    defaultResources: { maxMemoryMB: 0, maxCpuPercent: 0, timeoutMs: 300000 },
  },
  process: {
    description: 'Separate OS process with resource limits',
    overhead: 50,   // MB overhead
    security: 'medium',
    defaultResources: { maxMemoryMB: 512, maxCpuPercent: 50, timeoutMs: 120000 },
  },
  worktree: {
    description: 'Git worktree isolation + separate process',
    overhead: 100,
    security: 'medium',
    defaultResources: { maxMemoryMB: 512, maxCpuPercent: 50, timeoutMs: 180000 },
  },
  container: {
    description: 'Full container isolation (Docker/Podman)',
    overhead: 200,
    security: 'high',
    defaultResources: { maxMemoryMB: 1024, maxCpuPercent: 100, timeoutMs: 300000 },
  },
};

/**
 * Create a VM specification for a task.
 *
 * @param {object} opts
 * @param {string} opts.taskId
 * @param {string} opts.roleId
 * @param {string} opts.isolation - 'none' | 'process' | 'worktree' | 'container'
 * @param {object} [opts.resources] - { maxMemoryMB, maxCpuPercent, timeoutMs }
 * @returns {{ id, taskId, roleId, isolation, resources, createdAt }}
 */
export function createVMSpec({ taskId, roleId, isolation, resources } = {}) {
  const level = ISOLATION_LEVELS[isolation] || ISOLATION_LEVELS.process;
  const defaults = level.defaultResources;

  return {
    id: randomUUID(),
    taskId,
    roleId,
    isolation: isolation || 'process',
    resources: {
      maxMemoryMB: resources?.maxMemoryMB || defaults.maxMemoryMB,
      maxCpuPercent: resources?.maxCpuPercent || defaults.maxCpuPercent,
      timeoutMs: resources?.timeoutMs || defaults.timeoutMs,
    },
    security: level.security,
    overhead: level.overhead,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create an execution matrix for a set of DAG tasks.
 *
 * @param {object} opts
 * @param {Array<{ id, roleId, isolation, resources }>} opts.tasks
 * @returns {{ vms: VMSpec[], totalResources: { memoryMB, cpuPercent }, concurrentMax: number }}
 */
export function createExecutionMatrix({ tasks } = {}) {
  const vms = tasks.map(t => createVMSpec({
    taskId: t.id,
    roleId: t.roleId,
    isolation: t.isolation || 'process',
    resources: t.resources,
  }));

  const totalMemory = vms.reduce((sum, vm) => sum + vm.resources.maxMemoryMB + vm.overhead, 0);
  const totalCpu = vms.reduce((sum, vm) => sum + vm.resources.maxCpuPercent, 0);

  return {
    vms,
    totalResources: {
      memoryMB: totalMemory,
      cpuPercent: totalCpu,
    },
    concurrentMax: vms.length,
  };
}

/**
 * Validate a resource request against system limits.
 *
 * @param {object} opts
 * @param {object} opts.requested - { maxMemoryMB, maxCpuPercent }
 * @param {object} opts.systemLimits - { totalMemoryMB, totalCpuPercent }
 * @param {object} opts.currentUsage - { memoryMB, cpuPercent }
 * @returns {{ allowed: boolean, reason?: string, available: { memoryMB, cpuPercent } }}
 */
export function validateResourceQuota({ requested, systemLimits, currentUsage } = {}) {
  const availableMemory = systemLimits.totalMemoryMB - currentUsage.memoryMB;
  const availableCpu = systemLimits.totalCpuPercent - currentUsage.cpuPercent;

  const memoryOk = requested.maxMemoryMB <= availableMemory;
  const cpuOk = requested.maxCpuPercent <= availableCpu;

  if (memoryOk && cpuOk) {
    return {
      allowed: true,
      available: { memoryMB: availableMemory, cpuPercent: availableCpu },
    };
  }

  const reasons = [];
  if (!memoryOk) reasons.push(`memory: requested ${requested.maxMemoryMB}MB, available ${availableMemory}MB`);
  if (!cpuOk) reasons.push(`cpu: requested ${requested.maxCpuPercent}%, available ${availableCpu}%`);

  return {
    allowed: false,
    reason: reasons.join('; '),
    available: { memoryMB: availableMemory, cpuPercent: availableCpu },
  };
}
