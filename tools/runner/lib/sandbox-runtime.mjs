import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

/**
 * Sandbox Runtime — enforcement layer for isolated task execution.
 *
 * Validates actions (file access, network, exec) against a sandbox configuration.
 * Builds restricted environment variables for child processes.
 *
 * Does NOT use OS-level sandboxing (no cgroups, no seccomp). Instead, it relies on:
 *   - Path-based allow/block lists (checked before each action)
 *   - Environment variable restrictions (secrets stripped)
 *   - Resource hints (memory/CPU limits passed as env vars for cooperative enforcement)
 *   - Network access flags (checked at action dispatch time)
 */

// ── Isolation level presets ──

/**
 * Pre-defined isolation levels from L0 (none) to L3 (full lockdown).
 */
export const ISOLATION_LEVELS = {
  /** L0 — No isolation. Full access to everything. For trusted local dev. */
  L0: {
    level: 0,
    name: 'none',
    description: 'No isolation — full access',
    allowedPaths: ['**/*'],
    blockedPaths: [],
    networkAccess: true,
    maxMemoryMB: 0,     // 0 = unlimited
    maxCpuPercent: 100,
  },

  /** L1 — Path restrictions only. Block secrets, limit write scope. */
  L1: {
    level: 1,
    name: 'path-restricted',
    description: 'Path restrictions — block secrets and sensitive files',
    allowedPaths: ['**/*'],
    blockedPaths: [
      '.env', '.env.*', '.env.local', '.env.production',
      '*.pem', '*.key', '*.p12', '*.pfx',
      '.ogu/secrets', '.ogu/secrets/**',
      '**/credentials.json', '**/.npmrc', '**/.pypirc',
    ],
    networkAccess: true,
    maxMemoryMB: 0,
    maxCpuPercent: 100,
  },

  /** L2 — Path + network restrictions. Standard agent isolation. */
  L2: {
    level: 2,
    name: 'standard',
    description: 'Path + network restrictions — standard agent sandbox',
    allowedPaths: ['src/**', 'lib/**', 'tools/**', 'docs/**', 'tests/**', 'package.json', 'tsconfig.json'],
    blockedPaths: [
      '.env', '.env.*', '.env.local', '.env.production',
      '*.pem', '*.key', '*.p12', '*.pfx',
      '.ogu/secrets', '.ogu/secrets/**',
      '**/credentials.json', '**/.npmrc', '**/.pypirc',
      '.git/config', '.git/credentials',
      'node_modules/.cache/**',
    ],
    networkAccess: false,
    maxMemoryMB: 2048,
    maxCpuPercent: 50,
  },

  /** L3 — Full lockdown. Minimal file access, no network, strict limits. */
  L3: {
    level: 3,
    name: 'locked-down',
    description: 'Full lockdown — minimal access, no network, strict resource limits',
    allowedPaths: [],    // Must be explicitly set per task
    blockedPaths: ['**/*'],  // Block everything by default
    networkAccess: false,
    maxMemoryMB: 512,
    maxCpuPercent: 25,
  },
};

/**
 * Create a sandbox configuration.
 *
 * @param {object} options
 * @param {string[]} [options.allowedPaths=[]] - Glob patterns for allowed file access
 * @param {string[]} [options.blockedPaths=[]] - Glob patterns for blocked file access
 * @param {boolean} [options.networkAccess=false] - Whether network access is allowed
 * @param {number} [options.maxMemoryMB=2048] - Memory limit in MB (0 = unlimited)
 * @param {number} [options.maxCpuPercent=50] - CPU usage limit percentage
 * @returns {object} Sandbox configuration
 */
export function createSandbox({
  allowedPaths = [],
  blockedPaths = [],
  networkAccess = false,
  maxMemoryMB = 2048,
  maxCpuPercent = 50,
} = {}) {
  return {
    $type: 'SandboxConfig',
    allowedPaths: Array.isArray(allowedPaths) ? allowedPaths : [],
    blockedPaths: Array.isArray(blockedPaths) ? blockedPaths : [],
    networkAccess: Boolean(networkAccess),
    maxMemoryMB: Math.max(0, Number(maxMemoryMB) || 2048),
    maxCpuPercent: Math.min(100, Math.max(0, Number(maxCpuPercent) || 50)),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Check if an action is allowed within the sandbox.
 *
 * @param {object} sandbox - Sandbox config from createSandbox()
 * @param {object} action - Action to validate
 * @param {string} action.type - 'file_read' | 'file_write' | 'network' | 'exec'
 * @param {string} [action.path] - File path (for file_read/file_write)
 * @param {string} [action.target] - Target host/URL (for network)
 * @param {string} [action.command] - Command (for exec)
 * @returns {{ allowed: boolean, reason: string }}
 */
export function enforceSandbox(sandbox, action) {
  if (!sandbox || !sandbox.$type) {
    return { allowed: true, reason: 'No sandbox configured' };
  }
  if (!action || !action.type) {
    return { allowed: false, reason: 'Invalid action: missing type' };
  }

  switch (action.type) {
    case 'file_read':
    case 'file_write':
      return enforceFileAccess(sandbox, action);

    case 'network':
      return enforceNetworkAccess(sandbox, action);

    case 'exec':
      return enforceExecAccess(sandbox, action);

    default:
      return { allowed: false, reason: `Unknown action type: ${action.type}` };
  }
}

/**
 * Enforce file access restrictions.
 */
function enforceFileAccess(sandbox, action) {
  const { path: filePath } = action;
  if (!filePath) {
    return { allowed: false, reason: 'File action missing path' };
  }

  // Normalize path for matching
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check blocked paths first (block wins over allow)
  for (const pattern of sandbox.blockedPaths) {
    if (globMatch(normalizedPath, pattern)) {
      return {
        allowed: false,
        reason: `Path blocked by pattern "${pattern}": ${filePath}`,
      };
    }
  }

  // If no allowed paths specified, allow everything not blocked
  if (sandbox.allowedPaths.length === 0) {
    return { allowed: true, reason: 'No allow-list configured — allowed by default' };
  }

  // Check if path matches any allowed pattern
  for (const pattern of sandbox.allowedPaths) {
    if (globMatch(normalizedPath, pattern)) {
      return { allowed: true, reason: `Matches allowed pattern "${pattern}"` };
    }
  }

  return {
    allowed: false,
    reason: `Path not in allowed list: ${filePath}`,
  };
}

/**
 * Enforce network access restrictions.
 */
function enforceNetworkAccess(sandbox, action) {
  if (!sandbox.networkAccess) {
    return {
      allowed: false,
      reason: 'Network access is disabled in this sandbox',
    };
  }

  // Network is allowed — could add host/port filtering here
  return { allowed: true, reason: 'Network access permitted' };
}

/**
 * Enforce exec access restrictions.
 */
function enforceExecAccess(sandbox, action) {
  const { command } = action;
  if (!command) {
    return { allowed: false, reason: 'Exec action missing command' };
  }

  // Block known dangerous commands
  const dangerousCommands = [
    'rm -rf /',
    'dd if=',
    'mkfs',
    'format',
    ':(){:|:&};:',  // fork bomb
    'chmod -R 777 /',
    'curl | sh',
    'wget | sh',
  ];

  const lowerCmd = command.toLowerCase().trim();
  for (const dangerous of dangerousCommands) {
    if (lowerCmd.includes(dangerous)) {
      return {
        allowed: false,
        reason: `Blocked dangerous command pattern: "${dangerous}"`,
      };
    }
  }

  return { allowed: true, reason: 'Command permitted' };
}

/**
 * Build environment variables that enforce sandbox restrictions for child processes.
 *
 * Returns a clean env object that:
 * - Strips secret-containing variables
 * - Sets resource limit hints
 * - Removes dangerous env vars
 *
 * @param {object} sandbox - Sandbox config
 * @returns {object} Sanitized environment variables
 */
export function buildSandboxEnv(sandbox) {
  if (!sandbox) return { ...process.env };

  const env = {};

  // Patterns that indicate secret values
  const secretPatterns = [
    /_KEY$/i, /_SECRET$/i, /_TOKEN$/i, /_PASSWORD$/i,
    /_CREDENTIAL$/i, /^API_KEY/i, /^AUTH_/i,
    /^AWS_SECRET/i, /^GITHUB_TOKEN$/i, /^NPM_TOKEN$/i,
    /^DATABASE_URL$/i, /^REDIS_URL$/i,
  ];

  // Copy parent env, stripping secrets
  for (const [key, value] of Object.entries(process.env)) {
    const isSecret = secretPatterns.some(pattern => pattern.test(key));
    if (!isSecret) {
      env[key] = value;
    }
  }

  // Set resource limit hints
  if (sandbox.maxMemoryMB > 0) {
    env.OGU_SANDBOX_MEMORY_LIMIT_MB = String(sandbox.maxMemoryMB);
    env.NODE_OPTIONS = `--max-old-space-size=${sandbox.maxMemoryMB}`;
  }

  if (sandbox.maxCpuPercent < 100) {
    env.OGU_SANDBOX_CPU_LIMIT_PERCENT = String(sandbox.maxCpuPercent);
  }

  // Network flag
  env.OGU_SANDBOX_NETWORK = sandbox.networkAccess ? '1' : '0';

  // Mark as sandboxed
  env.OGU_SANDBOXED = '1';
  env.OGU_SANDBOX_LEVEL = String(sandbox.level || 'custom');

  return env;
}

/**
 * Validate a sandbox configuration object.
 *
 * @param {object} config - Object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSandboxConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be a non-null object'] };
  }

  // allowedPaths
  if (config.allowedPaths !== undefined) {
    if (!Array.isArray(config.allowedPaths)) {
      errors.push('allowedPaths must be an array');
    } else {
      for (let i = 0; i < config.allowedPaths.length; i++) {
        if (typeof config.allowedPaths[i] !== 'string') {
          errors.push(`allowedPaths[${i}] must be a string`);
        }
      }
    }
  }

  // blockedPaths
  if (config.blockedPaths !== undefined) {
    if (!Array.isArray(config.blockedPaths)) {
      errors.push('blockedPaths must be an array');
    } else {
      for (let i = 0; i < config.blockedPaths.length; i++) {
        if (typeof config.blockedPaths[i] !== 'string') {
          errors.push(`blockedPaths[${i}] must be a string`);
        }
      }
    }
  }

  // networkAccess
  if (config.networkAccess !== undefined && typeof config.networkAccess !== 'boolean') {
    errors.push('networkAccess must be a boolean');
  }

  // maxMemoryMB
  if (config.maxMemoryMB !== undefined) {
    const mem = Number(config.maxMemoryMB);
    if (isNaN(mem) || mem < 0) {
      errors.push('maxMemoryMB must be a non-negative number');
    }
    if (mem > 65536) {
      errors.push('maxMemoryMB exceeds maximum (65536 MB)');
    }
  }

  // maxCpuPercent
  if (config.maxCpuPercent !== undefined) {
    const cpu = Number(config.maxCpuPercent);
    if (isNaN(cpu) || cpu < 0 || cpu > 100) {
      errors.push('maxCpuPercent must be between 0 and 100');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Glob matching ──

/**
 * Simple glob matching for sandbox path rules.
 *
 * Supports:
 *   - `*` matches any characters except `/`
 *   - `**` matches any characters including `/` (directory traversal)
 *   - `.` is literal (no regex interpretation)
 *
 * @param {string} str - Path to test
 * @param {string} pattern - Glob pattern
 * @returns {boolean}
 */
function globMatch(str, pattern) {
  // Exact match
  if (str === pattern) return true;

  // Convert glob to regex
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // ** — match everything including /
        if (pattern[i + 2] === '/') {
          regex += '(?:.*/)?';
          i += 3;
        } else {
          regex += '.*';
          i += 2;
        }
      } else {
        // * — match everything except /
        regex += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      regex += '[^/]';
      i++;
    } else if (ch === '.') {
      regex += '\\.';
      i++;
    } else if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === '+' || ch === '^' || ch === '$' || ch === '|') {
      regex += '\\' + ch;
      i++;
    } else {
      regex += ch;
      i++;
    }
  }

  try {
    return new RegExp(`^${regex}$`).test(str);
  } catch {
    // Invalid pattern — fall back to substring match
    return str.includes(pattern.replace(/\*/g, ''));
  }
}
