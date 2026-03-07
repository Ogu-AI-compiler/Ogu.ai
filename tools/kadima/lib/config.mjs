import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getOguRoot, resolveOguPath } from '../../ogu/commands/lib/runtime-paths.mjs';

/**
 * Kadima Config — Loads, validates, and persists daemon configuration.
 *
 * Config file: .ogu/kadima.config.json
 * Supports environment overrides: OGU_KADIMA_PORT, OGU_KADIMA_MAX_RUNNERS, etc.
 */

const CONFIG_VERSION = 1;

const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  loops: {
    scheduler:        { intervalMs: 5000,  enabled: true },
    stateMachine:     { intervalMs: 10000, enabled: true },
    consistency:      { intervalMs: 30000, enabled: true },
    metricsAggregator:{ intervalMs: 60000, enabled: true },
    circuitProber:    { intervalMs: 15000, enabled: true },
    knowledge:        { intervalMs: 300000, enabled: true },  // 5 min
  },
  api: { host: '127.0.0.1', port: 4210, metricsPort: 4211 },
  runners: { maxConcurrent: 4, spawnMode: 'local', timeoutMs: 600000 },
  circuitBreakers: { defaultCooldownMs: 60000 },
  logging: { level: 'info', maxLogFiles: 30, maxLogSizeMb: 50 },
};

const LOOP_NAMES = [
  'scheduler', 'stateMachine', 'consistency',
  'metricsAggregator', 'circuitProber', 'knowledge',
];

/**
 * Load config from .ogu/kadima.config.json, merge with defaults, apply env overrides.
 *
 * @param {string} root - Project root
 * @param {object} [overrides] - Optional programmatic overrides (highest priority)
 * @returns {object} Fully merged config
 */
export function loadConfig(root, overrides = {}) {
  const configPath = resolveOguPath(root, 'kadima.config.json');

  // Layer 1: defaults
  let config = structuredClone(DEFAULT_CONFIG);

  // Layer 2: file
  if (existsSync(configPath)) {
    try {
      const file = JSON.parse(readFileSync(configPath, 'utf8'));
      config = deepMerge(config, file);
    } catch { /* corrupt file — use defaults */ }
  }

  // Layer 3: environment variables
  const envOverrides = readEnvOverrides();
  config = deepMerge(config, envOverrides);

  // Layer 4: programmatic overrides
  if (overrides && Object.keys(overrides).length > 0) {
    config = deepMerge(config, overrides);
  }

  // Ensure version
  config.version = CONFIG_VERSION;

  return config;
}

/**
 * Save config to .ogu/kadima.config.json.
 */
export function saveConfig(root, config) {
  const dir = getOguRoot(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'kadima.config.json'),
    JSON.stringify(config, null, 2),
    'utf8'
  );
}

/**
 * Validate config structure. Returns { valid, errors }.
 */
export function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }

  // API validation
  if (config.api) {
    if (config.api.port && (config.api.port < 1 || config.api.port > 65535)) {
      errors.push(`Invalid port: ${config.api.port}`);
    }
    if (config.api.metricsPort && (config.api.metricsPort < 1 || config.api.metricsPort > 65535)) {
      errors.push(`Invalid metricsPort: ${config.api.metricsPort}`);
    }
    if (config.api.port && config.api.metricsPort && config.api.port === config.api.metricsPort) {
      errors.push('port and metricsPort must be different');
    }
  }

  // Runners validation
  if (config.runners) {
    if (config.runners.maxConcurrent !== undefined) {
      if (!Number.isInteger(config.runners.maxConcurrent) || config.runners.maxConcurrent < 1) {
        errors.push(`maxConcurrent must be a positive integer, got ${config.runners.maxConcurrent}`);
      }
    }
    if (config.runners.timeoutMs !== undefined) {
      if (config.runners.timeoutMs < 1000) {
        errors.push(`timeoutMs must be >= 1000ms, got ${config.runners.timeoutMs}`);
      }
    }
    if (config.runners.spawnMode && !['local', 'docker', 'vm'].includes(config.runners.spawnMode)) {
      errors.push(`Invalid spawnMode: ${config.runners.spawnMode}`);
    }
  }

  // Loops validation
  if (config.loops) {
    for (const name of LOOP_NAMES) {
      const loop = config.loops[name];
      if (loop && loop.intervalMs !== undefined) {
        if (!Number.isInteger(loop.intervalMs) || loop.intervalMs < 500) {
          errors.push(`Loop ${name}: intervalMs must be >= 500, got ${loop.intervalMs}`);
        }
      }
    }
  }

  // Circuit breakers
  if (config.circuitBreakers?.defaultCooldownMs !== undefined) {
    if (config.circuitBreakers.defaultCooldownMs < 1000) {
      errors.push(`defaultCooldownMs must be >= 1000, got ${config.circuitBreakers.defaultCooldownMs}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get the effective loop configuration for a specific loop.
 */
export function getLoopConfig(config, loopName) {
  const loopConf = config?.loops?.[loopName] || {};
  const defaults = DEFAULT_CONFIG.loops[loopName] || { intervalMs: 30000, enabled: true };
  return {
    intervalMs: loopConf.intervalMs ?? defaults.intervalMs,
    enabled: loopConf.enabled ?? defaults.enabled,
  };
}

/**
 * Get default config (for reference/init).
 */
export function getDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}

// ── Internals ──

/**
 * Read environment variable overrides.
 * OGU_KADIMA_PORT=4220         → config.api.port = 4220
 * OGU_KADIMA_MAX_RUNNERS=8     → config.runners.maxConcurrent = 8
 * OGU_KADIMA_TIMEOUT_MS=300000 → config.runners.timeoutMs = 300000
 * OGU_KADIMA_HOST=0.0.0.0      → config.api.host = '0.0.0.0'
 * OGU_KADIMA_LOG_LEVEL=debug   → config.logging.level = 'debug'
 */
function readEnvOverrides() {
  const overrides = {};

  const port = process.env.OGU_KADIMA_PORT;
  if (port) {
    overrides.api = overrides.api || {};
    overrides.api.port = parseInt(port, 10);
  }

  const host = process.env.OGU_KADIMA_HOST;
  if (host) {
    overrides.api = overrides.api || {};
    overrides.api.host = host;
  }

  const maxRunners = process.env.OGU_KADIMA_MAX_RUNNERS;
  if (maxRunners) {
    overrides.runners = overrides.runners || {};
    overrides.runners.maxConcurrent = parseInt(maxRunners, 10);
  }

  const timeoutMs = process.env.OGU_KADIMA_TIMEOUT_MS;
  if (timeoutMs) {
    overrides.runners = overrides.runners || {};
    overrides.runners.timeoutMs = parseInt(timeoutMs, 10);
  }

  const logLevel = process.env.OGU_KADIMA_LOG_LEVEL;
  if (logLevel) {
    overrides.logging = overrides.logging || {};
    overrides.logging.level = logLevel;
  }

  return overrides;
}

/**
 * Deep merge source into target (non-destructive).
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
