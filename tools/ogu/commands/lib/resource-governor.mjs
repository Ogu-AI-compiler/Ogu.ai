import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Resource Governor — concurrency limits, resource tracking, queue management.
 *
 * File-based state for cross-process coordination.
 * Config: .ogu/resource-governor.json
 * State:  .ogu/locks/active.json
 */

export const RESOURCE_PRESETS = {
  small:  { maxConcurrency: 2, maxMemoryMB: 256,  maxCpuPercent: 50 },
  medium: { maxConcurrency: 4, maxMemoryMB: 512,  maxCpuPercent: 75 },
  large:  { maxConcurrency: 8, maxMemoryMB: 1024, maxCpuPercent: 90 },
};

const CONFIG_PATH = '.ogu/resource-governor.json';
const LOCKS_DIR = '.ogu/locks';
const ACTIVE_PATH = '.ogu/locks/active.json';

const DEFAULT_CONFIG = {
  $schema: 'ResourceGovernor/1.0',
  limits: {
    maxParallelAgents: 3,
    maxParallelModelCalls: 2,
    maxParallelBuilds: 1,
    maxParallelTests: 2,
    maxWorktrees: 5,
  },
  queuing: {
    policy: 'priority',
    maxQueueSize: 20,
    queueTimeoutMs: 600000,
  },
  resourceTypes: {
    model_call: { maxConcurrent: 2, description: 'Concurrent LLM API calls' },
    build: { maxConcurrent: 1, mutuallyExclusive: ['test_integration'], description: 'npm build / compile processes' },
    test_unit: { maxConcurrent: 2, description: 'Unit test runners' },
    test_integration: { maxConcurrent: 1, mutuallyExclusive: ['build'], description: 'Integration / E2E tests' },
    worktree: { maxConcurrent: 5, description: 'Git worktree instances' },
    npm_install: { maxConcurrent: 1, description: 'npm/pnpm install (single-writer)' },
  },
};

function loadConfig(root) {
  const configPath = join(root, CONFIG_PATH);
  if (existsSync(configPath)) {
    try { return JSON.parse(readFileSync(configPath, 'utf8')); } catch { /* fall through */ }
  }
  return DEFAULT_CONFIG;
}

function loadActive(root) {
  const dir = join(root, LOCKS_DIR);
  mkdirSync(dir, { recursive: true });
  const activePath = join(root, ACTIVE_PATH);
  if (existsSync(activePath)) {
    try { return JSON.parse(readFileSync(activePath, 'utf8')); } catch { /* fall through */ }
  }
  return { slots: [], queue: [] };
}

function saveActive(root, active) {
  mkdirSync(join(root, LOCKS_DIR), { recursive: true });
  writeFileSync(join(root, ACTIVE_PATH), JSON.stringify(active, null, 2));
}

/**
 * Ensure resource-governor.json config exists.
 */
export function ensureConfig(root) {
  root = root || repoRoot();
  const configPath = join(root, CONFIG_PATH);
  if (!existsSync(configPath)) {
    mkdirSync(join(root, '.ogu'), { recursive: true });
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }
  return loadConfig(root);
}

/**
 * Request a resource slot.
 *
 * @param {string} root
 * @param {object} opts
 * @param {string} opts.resourceType
 * @param {string} opts.agentId
 * @param {string} opts.taskId
 * @param {number} [opts.priority=5]
 * @returns {{ granted: boolean, slotId?: string, waitMs?: number, position?: number, reason?: string }}
 */
export function acquireResource(root, { resourceType, agentId, taskId, priority = 5 }) {
  root = root || repoRoot();
  const config = loadConfig(root);
  const resourceDef = config.resourceTypes[resourceType];
  if (!resourceDef) {
    return { granted: false, reason: `OGU2901: Unknown resource type: ${resourceType}` };
  }

  const active = loadActive(root);
  const currentCount = active.slots.filter(s => s.resourceType === resourceType).length;

  // Check mutual exclusivity
  const mutuallyExclusive = resourceDef.mutuallyExclusive || [];
  const conflicting = active.slots.filter(s => mutuallyExclusive.includes(s.resourceType));

  if (currentCount >= resourceDef.maxConcurrent || conflicting.length > 0) {
    // Queue the request
    active.queue = active.queue || [];
    const existing = active.queue.find(q => q.taskId === taskId && q.resourceType === resourceType);
    if (!existing) {
      active.queue.push({ resourceType, agentId, taskId, priority, enqueuedAt: new Date().toISOString() });
      active.queue.sort((a, b) => b.priority - a.priority);
    }
    saveActive(root, active);
    const position = active.queue.findIndex(q => q.taskId === taskId) + 1;
    return {
      granted: false,
      position,
      reason: conflicting.length > 0
        ? `Blocked by mutually exclusive: ${conflicting[0].resourceType}`
        : `${currentCount}/${resourceDef.maxConcurrent} slots used`,
    };
  }

  // Grant
  const slot = {
    id: randomUUID().slice(0, 8),
    resourceType, agentId, taskId,
    acquiredAt: new Date().toISOString(),
    priority,
  };
  active.slots.push(slot);
  saveActive(root, active);
  return { granted: true, slotId: slot.id };
}

/**
 * Release a resource slot.
 */
export function releaseResource(root, slotId) {
  root = root || repoRoot();
  const active = loadActive(root);
  active.slots = active.slots.filter(s => s.id !== slotId);
  saveActive(root, active);
  processQueue(root);
}

function processQueue(root) {
  const active = loadActive(root);
  if (!active.queue?.length) return;
  const config = loadConfig(root);
  const newQueue = [];

  for (const request of active.queue) {
    const def = config.resourceTypes[request.resourceType];
    if (!def) { newQueue.push(request); continue; }
    const currentCount = active.slots.filter(s => s.resourceType === request.resourceType).length;
    const mutual = (def.mutuallyExclusive || []);
    const blocked = active.slots.some(s => mutual.includes(s.resourceType));

    if (currentCount < def.maxConcurrent && !blocked) {
      active.slots.push({
        id: randomUUID().slice(0, 8),
        ...request,
        acquiredAt: new Date().toISOString(),
      });
    } else {
      newQueue.push(request);
    }
  }
  active.queue = newQueue;
  saveActive(root, active);
}

/**
 * Get current resource usage.
 */
export function resourceStatus(root) {
  root = root || repoRoot();
  const config = loadConfig(root);
  const active = loadActive(root);

  return Object.entries(config.resourceTypes).map(([type, def]) => {
    const used = active.slots.filter(s => s.resourceType === type).length;
    const queued = (active.queue || []).filter(q => q.resourceType === type).length;
    return {
      type,
      used,
      max: def.maxConcurrent,
      queued,
      available: def.maxConcurrent - used,
      description: def.description,
    };
  });
}

/**
 * Check if a wave can start given current resource usage.
 */
export function canStartWave(root, wave) {
  root = root || repoRoot();
  const config = loadConfig(root);
  const active = loadActive(root);
  const currentAgents = active.slots.filter(s => s.resourceType === 'model_call').length;
  const taskCount = wave.tasks?.length || wave.taskIds?.length || 0;

  if (currentAgents + taskCount > config.limits.maxParallelAgents) {
    return {
      canStart: false,
      reason: `Wave needs ${taskCount} agents but only ${config.limits.maxParallelAgents - currentAgents} slots available`,
    };
  }
  return { canStart: true };
}

/**
 * Legacy in-memory governor (backwards compatible).
 */
export function createGovernor({ maxConcurrency, maxMemoryMB, maxCpuPercent }) {
  const active = new Map();
  function usedMemory() {
    let total = 0;
    for (const v of active.values()) total += (v.memoryMB || 0);
    return total;
  }
  function canAcquire({ memoryMB = 0 } = {}) {
    if (active.size >= maxConcurrency) return false;
    if (usedMemory() + memoryMB > maxMemoryMB) return false;
    return true;
  }
  function acquire(taskId, { memoryMB = 0 } = {}) {
    if (active.has(taskId)) return { granted: true, reason: 'already-acquired' };
    if (active.size >= maxConcurrency) return { granted: false, reason: 'concurrency-limit' };
    if (usedMemory() + memoryMB > maxMemoryMB) return { granted: false, reason: 'memory-limit' };
    active.set(taskId, { memoryMB, acquiredAt: Date.now() });
    return { granted: true };
  }
  function release(taskId) { return active.delete(taskId); }
  function status() {
    return {
      activeTasks: active.size, maxConcurrency,
      availableSlots: maxConcurrency - active.size,
      usedMemoryMB: usedMemory(), maxMemoryMB, maxCpuPercent,
      tasks: [...active.entries()].map(([id, v]) => ({ id, ...v })),
    };
  }
  return { canAcquire, acquire, release, status };
}
