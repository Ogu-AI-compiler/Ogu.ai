import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fork, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

/**
 * MicroVM Execution Matrix — lightweight process isolation.
 *
 * Provides isolated execution environments for agent tasks using process-level
 * sandboxing. Each "VM" is a child process with restricted env, working directory,
 * and resource limits (enforced via env vars / nice / ulimit on supported platforms).
 *
 * VM state is stored at .ogu/state/vms.json.
 */

// ── Paths ──

const STATE_DIR = (root) => join(root, '.ogu', 'state');
const VMS_FILE = (root) => join(STATE_DIR(root), 'vms.json');
const VM_WORK_BASE = (root) => join(root, '.ogu', 'state', 'vm-workdirs');

// ── State persistence ──

function ensureStateDir(root) {
  const dir = STATE_DIR(root);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadVMs(root) {
  ensureStateDir(root);
  const file = VMS_FILE(root);
  if (!existsSync(file)) return { vms: {} };
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { vms: {} };
  }
}

function saveVMs(root, state) {
  ensureStateDir(root);
  writeFileSync(VMS_FILE(root), JSON.stringify(state, null, 2));
}

function getVM(root, vmId) {
  const state = loadVMs(root);
  return state.vms[vmId] || null;
}

function setVM(root, vmId, vmData) {
  const state = loadVMs(root);
  state.vms[vmId] = vmData;
  saveVMs(root, state);
}

function removeVM(root, vmId) {
  const state = loadVMs(root);
  delete state.vms[vmId];
  saveVMs(root, state);
}

// ── Default limits ──

const DEFAULT_LIMITS = {
  memoryLimitMB: 2048,
  cpuLimitPercent: 50,
  timeoutMs: 300000,    // 5 minutes
  allowedPaths: [],     // empty = allow all within workDir
  blockedPaths: ['.env', '.env.*', '*.pem', '*.key', '.ogu/secrets'],
  networkAccess: false,
};

// ── VM lifecycle ──

/**
 * Create an isolated execution environment.
 *
 * The "VM" is a logical container: a registered entry in vms.json with
 * a unique working directory, restricted env, and resource limits.
 *
 * @param {string} root - Repo root (or null for auto-detect)
 * @param {object} options
 * @param {string} options.agentId - Agent creating this VM
 * @param {string} options.taskId - Task this VM is for
 * @param {string} [options.featureSlug] - Feature context
 * @param {object} [options.sandbox] - Sandbox restrictions
 * @param {boolean} [options.worktree=false] - Use a git worktree as workdir
 * @returns {object} { vmId, workDir, env, limits, cleanup }
 */
export function createVM(root, { agentId, taskId, featureSlug, sandbox, worktree = false } = {}) {
  root = root || repoRoot();
  const vmId = `vm-${randomUUID().slice(0, 12)}`;

  // Create working directory
  let workDir;
  if (worktree) {
    // Use a worktree-based workdir (isolated git copy)
    workDir = join(root, '.claude', 'worktrees', vmId);
  } else {
    // Use a temp workdir under .ogu/state
    workDir = join(VM_WORK_BASE(root), vmId);
  }

  if (!existsSync(workDir)) {
    mkdirSync(workDir, { recursive: true });
  }

  // Merge sandbox config with defaults
  const limits = {
    ...DEFAULT_LIMITS,
    ...(sandbox || {}),
  };

  // Build restricted environment
  const env = buildVMEnv(vmId, root, workDir, limits);

  // Register VM
  const vmData = {
    vmId,
    agentId: agentId || 'unknown',
    taskId: taskId || 'unknown',
    featureSlug: featureSlug || null,
    workDir,
    worktree,
    limits,
    status: 'created',
    pid: null,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    resourceUsage: {
      peakMemoryMB: 0,
      cpuTimeMs: 0,
      wallTimeMs: 0,
    },
    executionHistory: [],
  };

  setVM(root, vmId, vmData);

  emitAudit('microvm.created', {
    vmId,
    agentId,
    taskId,
    workDir,
    limits,
  }, {
    feature: featureSlug,
    tags: ['microvm', 'lifecycle'],
  });

  return {
    vmId,
    workDir,
    env,
    limits,
    cleanup: () => destroyVM(root, vmId),
  };
}

/**
 * Build restricted environment variables for a VM.
 *
 * @param {string} vmId
 * @param {string} root
 * @param {string} workDir
 * @param {object} limits
 * @returns {object} Environment variables
 */
function buildVMEnv(vmId, root, workDir, limits) {
  // Start with a minimal env — NOT inheriting the full parent env
  const env = {
    // Identity
    OGU_VM_ID: vmId,
    OGU_ROOT: root,
    OGU_VM_WORKDIR: workDir,

    // Minimal system vars
    HOME: process.env.HOME || '/tmp',
    PATH: process.env.PATH || '/usr/bin:/bin',
    SHELL: '/bin/sh',
    LANG: process.env.LANG || 'en_US.UTF-8',
    TERM: 'dumb',
    NODE_ENV: 'production',

    // Resource hints (not enforced by OS, but readable by child processes)
    OGU_VM_MEMORY_LIMIT_MB: String(limits.memoryLimitMB),
    OGU_VM_CPU_LIMIT_PERCENT: String(limits.cpuLimitPercent),
    OGU_VM_TIMEOUT_MS: String(limits.timeoutMs),
    OGU_VM_NETWORK_ACCESS: limits.networkAccess ? '1' : '0',

    // Node.js memory limit
    NODE_OPTIONS: `--max-old-space-size=${limits.memoryLimitMB}`,
  };

  // Explicitly block secret-containing env vars
  const blockedEnvPatterns = ['_KEY', '_SECRET', '_TOKEN', '_PASSWORD', '_CREDENTIAL', 'API_KEY'];
  // Intentionally NOT copying these from parent env

  return env;
}

/**
 * Configure resource limits for an existing VM.
 *
 * @param {string} vmId
 * @param {object} config
 * @param {number} [config.memoryLimitMB]
 * @param {number} [config.cpuLimitPercent]
 * @param {number} [config.timeoutMs]
 * @param {string[]} [config.allowedPaths]
 * @param {string[]} [config.blockedPaths]
 * @param {boolean} [config.networkAccess]
 * @returns {object} Updated VM data
 */
export function configureVM(vmId, { memoryLimitMB, cpuLimitPercent, timeoutMs, allowedPaths, blockedPaths, networkAccess } = {}) {
  const root = repoRoot();
  const vm = getVM(root, vmId);
  if (!vm) {
    throw new Error(`VM not found: ${vmId}`);
  }

  if (vm.status === 'destroyed') {
    throw new Error(`Cannot configure destroyed VM: ${vmId}`);
  }

  // Update limits
  if (memoryLimitMB !== undefined) vm.limits.memoryLimitMB = memoryLimitMB;
  if (cpuLimitPercent !== undefined) vm.limits.cpuLimitPercent = cpuLimitPercent;
  if (timeoutMs !== undefined) vm.limits.timeoutMs = timeoutMs;
  if (allowedPaths !== undefined) vm.limits.allowedPaths = allowedPaths;
  if (blockedPaths !== undefined) vm.limits.blockedPaths = blockedPaths;
  if (networkAccess !== undefined) vm.limits.networkAccess = networkAccess;

  vm.lastActivity = new Date().toISOString();
  setVM(root, vmId, vm);

  emitAudit('microvm.configured', { vmId, limits: vm.limits }, {
    feature: vm.featureSlug,
    tags: ['microvm', 'configure'],
  });

  return vm;
}

/**
 * Execute a command inside the VM context.
 *
 * Applies sandbox restrictions: working directory, env, timeout, memory limits.
 * On macOS/Linux, uses nice for CPU priority when possible.
 *
 * @param {string} root - Repo root
 * @param {string} vmId - VM identifier
 * @param {object} options
 * @param {string} options.command - Command to execute
 * @param {string[]} [options.args=[]] - Command arguments
 * @param {object} [options.env={}] - Additional env vars (merged with VM env)
 * @param {string} [options.stdin] - Stdin data
 * @returns {object} { stdout, stderr, exitCode, durationMs, resourceUsage }
 */
export function executeInVM(root, vmId, { command, args = [], env: extraEnv = {}, stdin } = {}) {
  root = root || repoRoot();
  const vm = getVM(root, vmId);
  if (!vm) {
    throw new Error(`VM not found: ${vmId}`);
  }

  if (vm.status === 'destroyed') {
    throw new Error(`Cannot execute in destroyed VM: ${vmId}`);
  }

  // Validate command against blocked paths
  const pathCheck = checkPathAccess(vm, command);
  if (!pathCheck.allowed) {
    return {
      stdout: '',
      stderr: `Sandbox violation: ${pathCheck.reason}`,
      exitCode: 126,
      durationMs: 0,
      resourceUsage: { memoryMB: 0, cpuTimeMs: 0 },
    };
  }

  // Build execution env
  const execEnv = {
    ...buildVMEnv(vmId, root, vm.workDir, vm.limits),
    ...extraEnv,
  };

  // Build the full command (with nice for CPU priority if available)
  let fullCommand = command;
  let fullArgs = args;
  if (vm.limits.cpuLimitPercent < 50 && process.platform !== 'win32') {
    // Use nice to lower CPU priority
    const niceLevel = Math.min(19, Math.floor(20 - (vm.limits.cpuLimitPercent / 5)));
    fullArgs = ['-n', String(niceLevel), command, ...args];
    fullCommand = 'nice';
  }

  const startTime = Date.now();

  // Update VM status
  vm.status = 'running';
  vm.lastActivity = new Date().toISOString();
  setVM(root, vmId, vm);

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    const cmdStr = [fullCommand, ...fullArgs].join(' ');
    const result = execSync(cmdStr, {
      cwd: vm.workDir,
      env: execEnv,
      timeout: vm.limits.timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      input: stdin || undefined,
      encoding: 'utf8',
      stdio: stdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    stdout = typeof result === 'string' ? result : '';
  } catch (err) {
    stdout = err.stdout || '';
    stderr = err.stderr || err.message || '';
    exitCode = err.status || 1;

    if (err.killed) {
      stderr += '\n[VM] Process killed (timeout or resource limit exceeded)';
      exitCode = 137;
    }
  }

  const durationMs = Date.now() - startTime;

  // Update VM state with execution record
  const resourceUsage = {
    memoryMB: 0, // Would need /proc or ps to measure accurately
    cpuTimeMs: durationMs, // Approximation
  };

  const execution = {
    id: randomUUID().slice(0, 8),
    command: [command, ...args].join(' '),
    exitCode,
    durationMs,
    timestamp: new Date().toISOString(),
  };

  // Reload VM state (may have changed during execution)
  const updatedVM = getVM(root, vmId);
  if (updatedVM) {
    updatedVM.status = 'idle';
    updatedVM.lastActivity = new Date().toISOString();
    updatedVM.resourceUsage.wallTimeMs += durationMs;
    updatedVM.resourceUsage.cpuTimeMs += durationMs;
    updatedVM.executionHistory.push(execution);

    // Keep only last 50 executions
    if (updatedVM.executionHistory.length > 50) {
      updatedVM.executionHistory = updatedVM.executionHistory.slice(-50);
    }

    setVM(root, vmId, updatedVM);
  }

  emitAudit('microvm.executed', {
    vmId,
    command: [command, ...args].join(' '),
    exitCode,
    durationMs,
  }, {
    feature: vm.featureSlug,
    tags: ['microvm', 'execute'],
    severity: exitCode === 0 ? 'info' : 'warn',
  });

  return {
    stdout,
    stderr,
    exitCode,
    durationMs,
    resourceUsage,
  };
}

/**
 * Check if a path is accessible within the VM's sandbox.
 *
 * @param {object} vm - VM data
 * @param {string} targetPath - Path to check
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkPathAccess(vm, targetPath) {
  const { allowedPaths, blockedPaths } = vm.limits;

  // Check blocked paths first
  if (blockedPaths && blockedPaths.length > 0) {
    for (const pattern of blockedPaths) {
      if (matchGlob(targetPath, pattern)) {
        return { allowed: false, reason: `Path matches blocked pattern: ${pattern}` };
      }
    }
  }

  // If allowed paths are specified, check membership
  if (allowedPaths && allowedPaths.length > 0) {
    const matched = allowedPaths.some(pattern => matchGlob(targetPath, pattern));
    if (!matched) {
      return { allowed: false, reason: `Path not in allowed list` };
    }
  }

  return { allowed: true };
}

/**
 * Simple glob matching (supports * and ** patterns).
 *
 * @param {string} str - String to test
 * @param {string} pattern - Glob pattern
 * @returns {boolean}
 */
function matchGlob(str, pattern) {
  // Handle exact matches
  if (str === pattern) return true;
  // Handle suffix matches (e.g., '*.pem')
  if (pattern.startsWith('*')) {
    return str.endsWith(pattern.slice(1));
  }
  // Handle prefix matches (e.g., '.ogu/secrets*')
  if (pattern.endsWith('*')) {
    return str.startsWith(pattern.slice(0, -1));
  }
  // Handle contains
  if (pattern.includes('**')) {
    const parts = pattern.split('**');
    return str.includes(parts[0]) && str.includes(parts[parts.length - 1]);
  }
  return str.includes(pattern);
}

/**
 * Destroy a VM: kill processes, clean up workdir if temporary.
 *
 * @param {string} root - Repo root
 * @param {string} vmId - VM identifier
 * @returns {{ destroyed: boolean, cleanedWorkDir: boolean }}
 */
export function destroyVM(root, vmId) {
  root = root || repoRoot();
  const vm = getVM(root, vmId);
  if (!vm) {
    return { destroyed: false, cleanedWorkDir: false };
  }

  // Kill any running processes associated with this VM
  if (vm.pid) {
    try {
      process.kill(vm.pid, 'SIGKILL');
    } catch {
      // Process may already be dead
    }
  }

  // Clean up workdir if it's under our managed area
  let cleanedWorkDir = false;
  const managedBase = VM_WORK_BASE(root);
  if (vm.workDir && vm.workDir.startsWith(managedBase) && existsSync(vm.workDir)) {
    try {
      rmSync(vm.workDir, { recursive: true, force: true });
      cleanedWorkDir = true;
    } catch {
      // Ignore cleanup errors
    }
  }

  emitAudit('microvm.destroyed', {
    vmId,
    agentId: vm.agentId,
    taskId: vm.taskId,
    totalWallTimeMs: vm.resourceUsage.wallTimeMs,
    totalExecutions: vm.executionHistory.length,
    cleanedWorkDir,
  }, {
    feature: vm.featureSlug,
    tags: ['microvm', 'lifecycle'],
  });

  // Mark as destroyed in state (keep record for audit)
  vm.status = 'destroyed';
  vm.destroyedAt = new Date().toISOString();
  setVM(root, vmId, vm);

  return { destroyed: true, cleanedWorkDir };
}

/**
 * List all active VMs.
 *
 * @param {string} root - Repo root
 * @returns {Array<object>} Array of VM entries
 */
export function listActiveVMs(root) {
  root = root || repoRoot();
  const state = loadVMs(root);
  return Object.values(state.vms).filter(vm =>
    vm.status !== 'destroyed'
  );
}

/**
 * Get status of a specific VM.
 *
 * @param {string} root - Repo root
 * @param {string} vmId - VM identifier
 * @returns {object|null} VM data or null if not found
 */
export function getVMStatus(root, vmId) {
  root = root || repoRoot();
  return getVM(root, vmId);
}

/**
 * Apply OS-level resource limits to a VM.
 *
 * Since we cannot use real cgroups without root, we enforce limits via:
 * - NODE_OPTIONS --max-old-space-size (memory)
 * - nice level (CPU priority)
 * - timeout on execSync (wall clock)
 * - Environment variables for child process awareness
 *
 * @param {string} vmId - VM identifier
 * @param {object} limits
 * @param {number} [limits.memoryLimitMB]
 * @param {number} [limits.cpuLimitPercent]
 * @param {number} [limits.timeoutMs]
 * @returns {object} Applied limits summary
 */
export function applyResourceLimits(vmId, limits = {}) {
  const root = repoRoot();
  const vm = getVM(root, vmId);
  if (!vm) {
    throw new Error(`VM not found: ${vmId}`);
  }

  const applied = {
    vmId,
    mechanisms: [],
  };

  // Memory: Node.js max-old-space-size
  if (limits.memoryLimitMB !== undefined) {
    vm.limits.memoryLimitMB = limits.memoryLimitMB;
    applied.mechanisms.push({
      resource: 'memory',
      mechanism: 'NODE_OPTIONS --max-old-space-size',
      value: `${limits.memoryLimitMB}MB`,
    });
  }

  // CPU: nice level (macOS/Linux)
  if (limits.cpuLimitPercent !== undefined) {
    vm.limits.cpuLimitPercent = limits.cpuLimitPercent;
    const niceLevel = Math.min(19, Math.floor(20 - (limits.cpuLimitPercent / 5)));
    applied.mechanisms.push({
      resource: 'cpu',
      mechanism: 'nice',
      value: `nice -n ${niceLevel} (${limits.cpuLimitPercent}%)`,
      note: process.platform === 'win32' ? 'Not available on Windows' : 'Applied',
    });
  }

  // Timeout: execSync timeout
  if (limits.timeoutMs !== undefined) {
    vm.limits.timeoutMs = limits.timeoutMs;
    applied.mechanisms.push({
      resource: 'time',
      mechanism: 'execSync timeout',
      value: `${limits.timeoutMs}ms`,
    });
  }

  vm.lastActivity = new Date().toISOString();
  setVM(root, vmId, vm);

  emitAudit('microvm.limits.applied', { vmId, applied }, {
    feature: vm.featureSlug,
    tags: ['microvm', 'resource-limits'],
  });

  return applied;
}

// ── Bulk operations ──

/**
 * Destroy all VMs that have been idle for longer than maxIdleMs.
 *
 * @param {string} root - Repo root
 * @param {number} [maxIdleMs=600000] - Max idle time (default 10 minutes)
 * @returns {{ destroyed: string[], kept: string[] }}
 */
export function cleanupIdleVMs(root, maxIdleMs = 600000) {
  root = root || repoRoot();
  const activeVMs = listActiveVMs(root);
  const now = Date.now();
  const destroyed = [];
  const kept = [];

  for (const vm of activeVMs) {
    const lastActivity = new Date(vm.lastActivity).getTime();
    const idleMs = now - lastActivity;

    if (idleMs > maxIdleMs && vm.status !== 'running') {
      destroyVM(root, vm.vmId);
      destroyed.push(vm.vmId);
    } else {
      kept.push(vm.vmId);
    }
  }

  return { destroyed, kept };
}

/**
 * Destroy all VMs (forced cleanup).
 *
 * @param {string} root - Repo root
 * @returns {{ destroyed: string[] }}
 */
export function destroyAllVMs(root) {
  root = root || repoRoot();
  const activeVMs = listActiveVMs(root);
  const destroyed = [];

  for (const vm of activeVMs) {
    destroyVM(root, vm.vmId);
    destroyed.push(vm.vmId);
  }

  return { destroyed };
}

/**
 * Get aggregate statistics for all VMs.
 *
 * @param {string} root - Repo root
 * @returns {object} { total, active, running, idle, destroyed, totalWallTimeMs, totalExecutions }
 */
export function getVMStats(root) {
  root = root || repoRoot();
  const state = loadVMs(root);
  const vms = Object.values(state.vms);

  const stats = {
    total: vms.length,
    active: 0,
    running: 0,
    idle: 0,
    created: 0,
    destroyed: 0,
    totalWallTimeMs: 0,
    totalExecutions: 0,
  };

  for (const vm of vms) {
    switch (vm.status) {
      case 'running':
        stats.running++;
        stats.active++;
        break;
      case 'idle':
        stats.idle++;
        stats.active++;
        break;
      case 'created':
        stats.created++;
        stats.active++;
        break;
      case 'destroyed':
        stats.destroyed++;
        break;
    }
    stats.totalWallTimeMs += vm.resourceUsage?.wallTimeMs || 0;
    stats.totalExecutions += vm.executionHistory?.length || 0;
  }

  return stats;
}
