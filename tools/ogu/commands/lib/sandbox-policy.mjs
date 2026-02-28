/**
 * Sandbox Policy Engine — filesystem/network/process/tool isolation per role.
 *
 * Resolves policies from sandbox-policy.json + OrgSpec.
 * Validates file access, tool access, and network access.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { repoRoot } from '../../util.mjs';

const POLICY_PATH = '.ogu/sandbox-policy.json';

/**
 * Maps risk tiers to process isolation levels.
 */
export const ISOLATION_TIERS = {
  low: 'process',
  medium: 'worktree',
  high: 'container',
  critical: 'container',
};

const DEFAULT_POLICY = {
  $schema: 'SandboxPolicy/1.0',
  global: {
    isolationLevel: 'worktree',
    defaultPolicy: 'standard',
    secretsHandling: {
      envFileAccess: 'deny_all',
      allowedEnvVars: ['NODE_ENV', 'PORT'],
      blockedPatterns: ['*_KEY', '*_SECRET', '*_TOKEN', '*_PASSWORD'],
    },
  },
  policies: {
    minimal: {
      description: 'Read-only access, no writes, no network, no secrets',
      filesystem: {
        readScope: ['src/**', 'docs/**', 'package.json', 'tsconfig.json'],
        writeScope: [],
        blockedPaths: ['.env*', '.ogu/secrets*', '*.pem', '*.key'],
      },
      network: { outbound: 'deny', allowedHosts: [], allowedPorts: [] },
      process: { maxMemoryMb: 512, maxCpuPercent: 25, timeoutMs: 120000, maxChildProcesses: 2 },
      tools: { allowed: ['Read', 'Glob', 'Grep'], blocked: ['Bash', 'Write', 'Edit'] },
      applicableRoles: ['qa'],
    },
    standard: {
      description: 'Read/write within ownership scope, limited network, no secrets',
      filesystem: {
        readScope: ['**/*'],
        writeScope: ['${agent.ownershipScope}'],
        blockedPaths: ['.env*', '.ogu/secrets*', '*.pem', '*.key', '.ogu/OrgSpec.json', '.ogu/governance/**'],
      },
      network: { outbound: 'allowlist', allowedHosts: ['localhost', '127.0.0.1'], allowedPorts: [3000, 5173, 5432, 6379] },
      process: { maxMemoryMb: 2048, maxCpuPercent: 50, timeoutMs: 300000, maxChildProcesses: 5 },
      tools: { allowed: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'], blocked: [] },
      applicableRoles: ['backend-dev', 'frontend-dev', 'designer'],
    },
    privileged: {
      description: 'Full access with auditing — for infra, security, leadership',
      filesystem: { readScope: ['**/*'], writeScope: ['**/*'], blockedPaths: ['.ogu/secrets*'] },
      network: { outbound: 'allow', allowedHosts: ['*'], allowedPorts: ['*'] },
      process: { maxMemoryMb: 4096, maxCpuPercent: 80, timeoutMs: 600000, maxChildProcesses: 10 },
      tools: { allowed: ['*'], blocked: [] },
      auditLevel: 'verbose',
      applicableRoles: ['devops', 'security', 'tech-lead', 'cto'],
    },
  },
  rolePolicyOverrides: {
    architect: {
      basePolicy: 'standard',
      overrides: {
        'filesystem.readScope': ['**/*'],
        'filesystem.writeScope': ['docs/vault/**', '.ogu/**'],
        'tools.allowed': ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
      },
    },
    pm: {
      basePolicy: 'minimal',
      overrides: {
        'filesystem.writeScope': ['docs/vault/04_Features/**'],
        'tools.allowed': ['Read', 'Write', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
      },
    },
    security: {
      basePolicy: 'privileged',
      overrides: {
        'filesystem.writeScope': [],
        'network.outbound': 'deny',
        auditLevel: 'verbose',
      },
    },
  },
};

function loadSandboxConfig(root) {
  const configPath = join(root, POLICY_PATH);
  if (existsSync(configPath)) {
    try { return JSON.parse(readFileSync(configPath, 'utf8')); } catch { /* fall through */ }
  }
  return DEFAULT_POLICY;
}

/**
 * Ensure sandbox-policy.json config exists.
 */
export function ensureSandboxConfig(root) {
  root = root || repoRoot();
  const configPath = join(root, POLICY_PATH);
  if (!existsSync(configPath)) {
    mkdirSync(join(root, '.ogu'), { recursive: true });
    writeFileSync(configPath, JSON.stringify(DEFAULT_POLICY, null, 2));
  }
  return loadSandboxConfig(root);
}

/**
 * Resolve the effective sandbox policy for a role.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.roleId
 * @returns {object} Resolved sandbox policy
 */
export function resolveSandboxPolicy({ root, roleId }) {
  root = root || repoRoot();
  const config = loadSandboxConfig(root);

  // Check for role-specific override
  const override = config.rolePolicyOverrides?.[roleId];
  if (override) {
    const base = JSON.parse(JSON.stringify(config.policies[override.basePolicy] || config.policies.standard));
    for (const [key, value] of Object.entries(override.overrides || {})) {
      const parts = key.split('.');
      let obj = base;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
    }
    base.policyName = `${override.basePolicy}+override`;
    return base;
  }

  // Find policy by applicableRoles
  for (const [policyName, policy] of Object.entries(config.policies)) {
    if (policy.applicableRoles?.includes(roleId)) {
      return { ...policy, policyName };
    }
  }

  return { ...config.policies[config.global.defaultPolicy], policyName: config.global.defaultPolicy };
}

/**
 * Validate a file access against sandbox policy.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.roleId
 * @param {string} opts.filePath
 * @param {string} [opts.mode='read']
 * @returns {{ allowed: boolean, reason: string }}
 */
export function validateFileAccess({ root, roleId, filePath, mode = 'read' }) {
  root = root || repoRoot();
  const policy = resolveSandboxPolicy({ root, roleId });
  const relPath = relative(root, resolve(root, filePath));

  // Check blocked paths
  for (const pattern of (policy.filesystem?.blockedPaths || [])) {
    if (matchGlob(relPath, pattern)) {
      return { allowed: false, reason: `OGU3201: Path '${relPath}' blocked by sandbox policy for role '${roleId}'` };
    }
  }

  // Check scope
  const scope = mode === 'read' ? policy.filesystem?.readScope : policy.filesystem?.writeScope;
  if (!scope || scope.length === 0) {
    return { allowed: false, reason: `OGU3202: Role '${roleId}' has no ${mode} permissions` };
  }

  const inScope = scope.some(pattern => matchGlob(relPath, pattern));
  if (!inScope) {
    return { allowed: false, reason: `OGU3203: Path '${relPath}' outside ${mode} scope for role '${roleId}'` };
  }

  return { allowed: true, reason: 'in scope' };
}

/**
 * Validate a tool invocation against sandbox policy.
 */
export function validateToolAccess({ root, roleId, toolName }) {
  root = root || repoRoot();
  const policy = resolveSandboxPolicy({ root, roleId });

  const blocked = policy.tools?.blocked || [];
  if (blocked.includes(toolName)) {
    return { allowed: false, reason: `OGU3204: Tool '${toolName}' blocked for role '${roleId}'` };
  }

  const allowed = policy.tools?.allowed || [];
  if (allowed.includes('*') || allowed.includes(toolName)) {
    return { allowed: true, reason: 'in allowlist' };
  }

  return { allowed: false, reason: `OGU3205: Tool '${toolName}' not in allowlist for role '${roleId}'` };
}

/**
 * Validate a network request against sandbox policy.
 */
export function validateNetworkAccess({ root, roleId, host, port }) {
  root = root || repoRoot();
  const policy = resolveSandboxPolicy({ root, roleId });
  const net = policy.network || {};

  if (net.outbound === 'deny') {
    return { allowed: false, reason: `OGU3206: Network access denied for role '${roleId}'` };
  }
  if (net.outbound === 'allow') {
    return { allowed: true, reason: 'full network access' };
  }
  // allowlist
  const hostOk = (net.allowedHosts || []).includes('*') || (net.allowedHosts || []).includes(host);
  const portOk = !port || (net.allowedPorts || []).includes('*') || (net.allowedPorts || []).includes(port);
  if (hostOk && portOk) {
    return { allowed: true, reason: 'host+port in allowlist' };
  }
  return { allowed: false, reason: `OGU3207: ${host}:${port} not in network allowlist for role '${roleId}'` };
}

/**
 * Legacy: validate access (backwards compatible).
 */
export function validateAccess(policy, filePath) {
  for (const denied of (policy.filesystem?.deniedPaths || policy.filesystem?.blockedPaths || [])) {
    if (filePath.startsWith(denied) || matchGlob(filePath, denied)) return { allowed: false, reason: `path denied: ${denied}` };
  }
  if (policy.filesystem?.mode === 'deny-all') return { allowed: false, reason: 'deny-all mode' };
  const allowed = policy.filesystem?.allowedPaths || policy.filesystem?.readScope || [];
  if (allowed.length > 0) {
    for (const a of allowed) {
      if (filePath.startsWith(a) || matchGlob(filePath, a)) return { allowed: true, reason: `matched: ${a}` };
    }
    return { allowed: false, reason: 'not in allowed paths' };
  }
  return { allowed: true, reason: 'no restrictions' };
}

/**
 * Build a sandbox environment object for a role at a given isolation tier.
 *
 * Strips secrets, sets resource limits, and injects the OGU_SANDBOXED flag.
 *
 * @param {string} root
 * @param {string} roleId
 * @param {string} [isolationTier='medium'] - low/medium/high/critical
 * @returns {object} { $type, roleId, isolationLevel, env, resourceLimits, policy }
 */
export function buildSandboxEnv(root, roleId, isolationTier = 'medium') {
  root = root || repoRoot();
  const policy = resolveSandboxPolicy({ root, roleId });
  const config = loadSandboxConfig(root);
  const blockedPatterns = config.global?.secretsHandling?.blockedPatterns || ['*_KEY', '*_SECRET', '*_TOKEN', '*_PASSWORD'];

  // Build env with secrets stripped
  const env = {
    OGU_SANDBOXED: '1',
    OGU_ROLE: roleId,
    OGU_ISOLATION: ISOLATION_TIERS[isolationTier] || 'worktree',
    NODE_ENV: process.env.NODE_ENV || 'production',
  };

  // Copy allowed env vars
  const allowedVars = config.global?.secretsHandling?.allowedEnvVars || ['NODE_ENV', 'PORT'];
  for (const varName of allowedVars) {
    if (process.env[varName] !== undefined) {
      env[varName] = process.env[varName];
    }
  }

  // Copy process env, filtering out secret patterns
  for (const [key, value] of Object.entries(process.env)) {
    if (env[key] !== undefined) continue; // Already set
    const isBlocked = blockedPatterns.some(pattern => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(key);
    });
    if (!isBlocked) {
      env[key] = value;
    }
  }

  return {
    $type: 'SandboxEnv',
    roleId,
    isolationLevel: ISOLATION_TIERS[isolationTier] || 'worktree',
    env,
    resourceLimits: policy.process || {},
    policy: policy.policyName || 'standard',
  };
}

/**
 * Enforce a sandbox policy on an action.
 *
 * Dispatches to validateFileAccess, validateToolAccess, or validateNetworkAccess
 * based on action.type.
 *
 * @param {{ $type: string, roleId: string }} sandbox - Sandbox config from buildSandboxEnv
 * @param {{ type: string, [key: string]: any }} action - Action to validate
 * @returns {{ allowed: boolean, reason: string }}
 */
export function enforceSandbox(sandbox, action) {
  if (!sandbox || !action) {
    return { allowed: false, reason: 'Missing sandbox or action' };
  }

  const root = action.root || repoRoot();
  const roleId = sandbox.roleId;

  switch (action.type) {
    case 'file':
      return validateFileAccess({ root, roleId, filePath: action.path, mode: action.mode || 'read' });
    case 'tool':
      return validateToolAccess({ root, roleId, toolName: action.tool });
    case 'network':
      return validateNetworkAccess({ root, roleId, host: action.host, port: action.port });
    case 'exec':
      // Check for dangerous commands
      const cmd = (action.command || '').toLowerCase();
      const dangerous = ['rm -rf', 'format', 'mkfs', 'dd if=', 'shutdown', 'reboot'];
      if (dangerous.some(d => cmd.includes(d))) {
        return { allowed: false, reason: `OGU3210: Dangerous command blocked: ${action.command}` };
      }
      return validateToolAccess({ root, roleId, toolName: 'Bash' });
    default:
      return { allowed: false, reason: `Unknown action type: ${action.type}` };
  }
}

/**
 * Validate a sandbox configuration object.
 * @param {object} config - Sandbox config to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSandboxConfig(config) {
  const errors = [];
  if (!config) { return { valid: false, errors: ['Config is null/undefined'] }; }
  if (!config.$type) errors.push('Missing $type field');
  if (!config.roleId) errors.push('Missing roleId field');
  if (!config.isolationLevel) errors.push('Missing isolationLevel field');
  if (!config.env || typeof config.env !== 'object') errors.push('Missing or invalid env object');
  return { valid: errors.length === 0, errors };
}

function matchGlob(path, pattern) {
  if (pattern === '**/*') return true;
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.') + '$');
    return regex.test(path);
  }
  return path.startsWith(pattern);
}
