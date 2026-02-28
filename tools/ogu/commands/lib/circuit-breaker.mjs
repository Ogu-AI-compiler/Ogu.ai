/**
 * Circuit Breaker — state machine per failure domain.
 *
 * States: closed → open → half-open → closed
 *
 * Each failure domain (FD-PROVIDER, FD-FILESYSTEM, FD-AUDIT, FD-BUDGET, FD-SCHEDULER)
 * has its own circuit breaker with configurable thresholds and cooldowns.
 *
 * State file: .ogu/state/circuit-breakers.json
 *
 * Also re-exports legacy createBreaker/createCircuitBreaker for backwards compat.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

const CB_STATE_PATH = (root) => join(root, '.ogu/state/circuit-breakers.json');

// ── Failure Domain Definitions ────────────────────────────────────────

export const FAILURE_DOMAINS = {
  'FD-PROVIDER': {
    domainId: 'FD-PROVIDER',
    name: 'Model Provider',
    failureModes: ['provider_down', 'model_degraded', 'rate_limited', 'auth_expired'],
    circuitBreaker: { threshold: 3, windowMs: 60000, cooldownMs: 120000 },
    failover: {
      strategy: 'next_provider_same_capability',
      chain: ['anthropic', 'openai', 'local'],
    },
    degradedMode: 'single_provider',
    haltOnFailure: false,
  },
  'FD-FILESYSTEM': {
    domainId: 'FD-FILESYSTEM',
    name: 'Local Filesystem',
    failureModes: ['disk_full', 'permission_denied', 'file_corrupted'],
    circuitBreaker: { threshold: 1, windowMs: 10000, cooldownMs: 60000 },
    failover: { strategy: 'emergency_read_only_mode' },
    degradedMode: 'read_only',
    haltOnFailure: true,
  },
  'FD-AUDIT': {
    domainId: 'FD-AUDIT',
    name: 'Audit Trail',
    failureModes: ['write_failed', 'index_corrupted', 'file_too_large'],
    circuitBreaker: null, // No circuit breaker — HALT on failure
    failover: { strategy: 'halt_system', emergencyPath: '.ogu/audit-emergency/' },
    degradedMode: 'audit_emergency',
    haltOnFailure: true,
  },
  'FD-BUDGET': {
    domainId: 'FD-BUDGET',
    name: 'Budget System',
    failureModes: ['budget_corrupted', 'budget_desync'],
    circuitBreaker: { threshold: 2, windowMs: 30000, cooldownMs: 60000 },
    failover: { strategy: 'reconstruct_from_audit' },
    degradedMode: 'budget_frozen',
    haltOnFailure: false,
  },
  'FD-SCHEDULER': {
    domainId: 'FD-SCHEDULER',
    name: 'Scheduler Engine',
    failureModes: ['state_corrupted', 'deadlock'],
    circuitBreaker: { threshold: 2, windowMs: 30000, cooldownMs: 60000 },
    failover: { strategy: 'rebuild_from_feature_states' },
    degradedMode: null,
    haltOnFailure: false,
  },
};

// ── State Management ──────────────────────────────────────────────────

export function loadBreakerState(root) {
  root = root || repoRoot();
  const path = CB_STATE_PATH(root);
  if (!existsSync(path)) {
    return { version: 1, breakers: {}, updatedAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { version: 1, breakers: {}, updatedAt: new Date().toISOString() };
  }
}

export function saveBreakerState(root, state) {
  root = root || repoRoot();
  state.updatedAt = new Date().toISOString();
  const dir = join(root, '.ogu/state');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CB_STATE_PATH(root), JSON.stringify(state, null, 2), 'utf8');
}

function getBreaker(state, domainId) {
  if (!state.breakers[domainId]) {
    state.breakers[domainId] = {
      domainId,
      state: 'closed',
      failures: [],
      lastFailure: null,
      lastSuccess: null,
      openedAt: null,
      halfOpenAt: null,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTrips: 0,
    };
  }
  return state.breakers[domainId];
}

// ── Core: callWithBreaker ─────────────────────────────────────────────

/**
 * Execute a function through its domain's circuit breaker.
 *
 * @param {string} root - repo root
 * @param {string} domainId - failure domain ID (e.g. 'FD-PROVIDER')
 * @param {Function} fn - async function to execute
 * @returns {{ success: boolean, result?: any, error?: string, breakerState: string }}
 */
export async function callWithBreaker(root, domainId, fn) {
  root = root || repoRoot();
  const domain = FAILURE_DOMAINS[domainId];
  if (!domain) {
    return { success: false, error: `Unknown failure domain: ${domainId}`, breakerState: 'unknown' };
  }

  // Audit domain has no circuit breaker — always execute, halt on failure
  if (!domain.circuitBreaker) {
    try {
      const result = await fn();
      return { success: true, result, breakerState: 'none' };
    } catch (err) {
      emitAudit('circuit.audit_failure', { domainId, error: err.message }, {});
      return {
        success: false,
        error: err.message,
        breakerState: 'none',
        action: 'halt_system',
        reason: `${domain.name} failure triggers system halt`,
      };
    }
  }

  const state = loadBreakerState(root);
  const breaker = getBreaker(state, domainId);
  const config = domain.circuitBreaker;

  switch (breaker.state) {
    case 'closed':
      return executeClosed(root, domainId, fn, breaker, config, state);
    case 'open':
      return executeOpen(root, domainId, fn, breaker, config, state);
    case 'half-open':
      return executeHalfOpen(root, domainId, fn, breaker, config, state);
    default:
      breaker.state = 'closed';
      saveBreakerState(root, state);
      return executeClosed(root, domainId, fn, breaker, config, state);
  }
}

async function executeClosed(root, domainId, fn, breaker, config, state) {
  try {
    const result = await fn();
    breaker.lastSuccess = new Date().toISOString();
    breaker.totalSuccesses++;
    pruneFailures(breaker, config);
    saveBreakerState(root, state);
    return { success: true, result, breakerState: 'closed' };
  } catch (err) {
    addFailure(breaker, config);
    saveBreakerState(root, state);

    if (breaker.failures.length >= config.threshold) {
      tripBreaker(root, domainId, breaker, state);
      return {
        success: false, error: err.message, breakerState: 'open',
        tripped: true, reason: `${config.threshold} failures in ${config.windowMs}ms window`,
      };
    }
    return { success: false, error: err.message, breakerState: 'closed' };
  }
}

async function executeOpen(root, domainId, fn, breaker, config, state) {
  const now = Date.now();
  const openedAt = new Date(breaker.openedAt).getTime();

  if (now - openedAt >= config.cooldownMs) {
    breaker.state = 'half-open';
    breaker.halfOpenAt = new Date().toISOString();
    saveBreakerState(root, state);
    emitAudit('circuit.half_open', { domainId, cooldownMs: config.cooldownMs }, {});
    return executeHalfOpen(root, domainId, fn, breaker, config, state);
  }

  const remainingMs = config.cooldownMs - (now - openedAt);
  return {
    success: false,
    error: `Circuit breaker OPEN for ${domainId}. Retry in ${Math.ceil(remainingMs / 1000)}s.`,
    breakerState: 'open',
    retryAfterMs: remainingMs,
  };
}

async function executeHalfOpen(root, domainId, fn, breaker, config, state) {
  try {
    const result = await fn();
    breaker.state = 'closed';
    breaker.failures = [];
    breaker.lastSuccess = new Date().toISOString();
    breaker.totalSuccesses++;
    breaker.openedAt = null;
    breaker.halfOpenAt = null;
    saveBreakerState(root, state);
    emitAudit('circuit.closed', { domainId, reason: 'probe_success' }, {});
    return { success: true, result, breakerState: 'closed', recovered: true };
  } catch (err) {
    tripBreaker(root, domainId, breaker, state);
    return {
      success: false, error: err.message, breakerState: 'open',
      tripped: true, reason: 'half-open probe failed',
    };
  }
}

// ── Internal Helpers ──────────────────────────────────────────────────

function addFailure(breaker, config) {
  const now = Date.now();
  breaker.failures.push(now);
  breaker.lastFailure = new Date().toISOString();
  breaker.totalFailures++;
  pruneFailures(breaker, config);
}

function pruneFailures(breaker, config) {
  const cutoff = Date.now() - config.windowMs;
  breaker.failures = breaker.failures.filter(ts => ts > cutoff);
}

function tripBreaker(root, domainId, breaker, state) {
  breaker.state = 'open';
  breaker.openedAt = new Date().toISOString();
  breaker.totalTrips++;
  saveBreakerState(root, state);
  emitAudit('circuit.tripped', {
    domainId,
    totalTrips: breaker.totalTrips,
    failureCount: breaker.failures.length,
  }, {});
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Manually reset (close) a circuit breaker.
 */
export function resetBreaker(root, domainId) {
  root = root || repoRoot();
  const state = loadBreakerState(root);
  const breaker = getBreaker(state, domainId);
  const previousState = breaker.state;
  breaker.state = 'closed';
  breaker.failures = [];
  breaker.openedAt = null;
  breaker.halfOpenAt = null;
  saveBreakerState(root, state);
  emitAudit('circuit.reset', { domainId, previousState }, {});
  return { domainId, previousState, newState: 'closed' };
}

/**
 * Get status of all circuit breakers.
 */
export function getAllBreakerStatus(root) {
  root = root || repoRoot();
  const state = loadBreakerState(root);

  return Object.entries(FAILURE_DOMAINS).map(([domainId, domain]) => {
    const breaker = state.breakers[domainId] || {
      state: domain.circuitBreaker ? 'closed' : 'none',
      totalFailures: 0,
      totalSuccesses: 0,
      totalTrips: 0,
      lastFailure: null,
      lastSuccess: null,
    };

    return {
      domainId,
      name: domain.name,
      breakerState: breaker.state,
      hasBreaker: !!domain.circuitBreaker,
      haltOnFailure: domain.haltOnFailure,
      degradedMode: domain.degradedMode,
      failureModes: domain.failureModes,
      totalFailures: breaker.totalFailures,
      totalSuccesses: breaker.totalSuccesses,
      totalTrips: breaker.totalTrips,
      lastFailure: breaker.lastFailure,
      lastSuccess: breaker.lastSuccess,
      openedAt: breaker.openedAt,
      config: domain.circuitBreaker,
      failoverStrategy: domain.failover.strategy,
    };
  });
}

/**
 * Get provider health status (FD-PROVIDER specific).
 */
export function getProviderHealth(root) {
  root = root || repoRoot();
  const state = loadBreakerState(root);
  const providerBreaker = state.breakers['FD-PROVIDER'] || {
    state: 'closed', totalFailures: 0, totalSuccesses: 0, totalTrips: 0,
    lastFailure: null, lastSuccess: null,
  };

  const domain = FAILURE_DOMAINS['FD-PROVIDER'];
  const chain = domain.failover.chain;

  let providers = [];
  try {
    const configPath = join(root, '.ogu/model-router.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      providers = (config.providers || []).map(p => ({
        name: p.name || p.provider,
        status: 'unknown',
        models: p.models || [],
      }));
    }
  } catch { /* skip */ }

  if (providers.length === 0) {
    providers = chain.map(name => ({ name, status: 'unknown', models: [] }));
  }

  return {
    domain: domain.name,
    breakerState: providerBreaker.state,
    failoverChain: chain,
    providers,
    circuit: {
      threshold: domain.circuitBreaker.threshold,
      windowMs: domain.circuitBreaker.windowMs,
      cooldownMs: domain.circuitBreaker.cooldownMs,
      recentFailures: providerBreaker.totalFailures,
      totalTrips: providerBreaker.totalTrips,
    },
  };
}

/**
 * Test failover chain (dry-run).
 */
export function testFailover(root, domainId) {
  root = root || repoRoot();
  const domain = FAILURE_DOMAINS[domainId || 'FD-PROVIDER'];
  if (!domain) return { success: false, error: `Unknown domain: ${domainId}` };

  const results = [];
  if (domain.failover.chain) {
    for (let i = 0; i < domain.failover.chain.length; i++) {
      results.push({
        position: i + 1,
        provider: domain.failover.chain[i],
        status: 'simulated_ok',
        latencyMs: Math.floor(Math.random() * 500 + 50),
        wouldFailover: i > 0,
      });
    }
  } else {
    results.push({
      position: 1,
      strategy: domain.failover.strategy,
      status: 'simulated_ok',
      wouldActivate: true,
    });
  }

  return { domainId: domain.domainId, strategy: domain.failover.strategy, dryRun: true, results };
}

// ── Legacy Exports (backwards compat) ─────────────────────────────────

// ── Trip + Probe (public wrappers) ────────────────────────────────────

/**
 * Manually trip a circuit breaker open.
 * @param {string} root - repo root
 * @param {string} domainId - failure domain ID
 * @param {string} reason - why the breaker is being tripped
 * @returns {{ domainId, previousState, newState, reason }}
 */
export function tripCircuitBreaker(root, domainId, reason) {
  root = root || repoRoot();
  const state = loadBreakerState(root);
  const breaker = getBreaker(state, domainId);
  const previousState = breaker.state;
  tripBreaker(root, domainId, breaker, state);
  return { domainId, previousState, newState: 'open', reason: reason || 'manual trip' };
}

/**
 * Probe a circuit breaker — return current status without executing anything.
 * @param {string} root - repo root
 * @param {string} domainId - failure domain ID
 * @returns {{ domainId, state, totalFailures, totalTrips, lastFailure, openedAt }}
 */
export function probeCircuitBreaker(root, domainId) {
  root = root || repoRoot();
  const state = loadBreakerState(root);
  const breaker = state.breakers[domainId] || {
    state: 'closed', totalFailures: 0, totalTrips: 0,
    lastFailure: null, openedAt: null,
  };
  return {
    domainId,
    state: breaker.state,
    totalFailures: breaker.totalFailures || 0,
    totalTrips: breaker.totalTrips || 0,
    lastFailure: breaker.lastFailure || null,
    openedAt: breaker.openedAt || null,
  };
}

export const BREAKER_STATES = ['closed', 'open', 'half-open'];

export function createBreaker({ name, threshold = 5, resetTimeMs = 30000 } = {}) {
  return {
    name, state: 'closed', failureCount: 0, successCount: 0,
    threshold, resetTimeMs, openedAt: null, lastFailureAt: null, lastSuccessAt: null,
  };
}

/**
 * Record a failure on a breaker object (from createBreaker).
 * Opens the breaker when failureCount reaches threshold.
 */
export function recordFailure(breaker) {
  breaker.failureCount++;
  breaker.lastFailureAt = Date.now();
  if (breaker.failureCount >= breaker.threshold) {
    breaker.state = 'open';
    breaker.openedAt = Date.now();
  }
}

/**
 * Record a success on a breaker object (from createBreaker).
 * Closes the breaker and resets failure count.
 */
export function recordSuccess(breaker) {
  breaker.failureCount = 0;
  breaker.state = 'closed';
  breaker.lastSuccessAt = Date.now();
  breaker.openedAt = null;
}

/**
 * Check if a call is allowed through the breaker.
 * Transitions from open to half-open after resetTimeMs.
 */
export function isAllowed(breaker) {
  if (breaker.state === 'closed') return true;
  if (breaker.state === 'half-open') return true;
  if (breaker.state === 'open') {
    const now = Date.now();
    if (now - breaker.openedAt >= breaker.resetTimeMs) {
      breaker.state = 'half-open';
      return true;
    }
    return false;
  }
  return false;
}

export function createCircuitBreaker({ failureThreshold, resetTimeoutMs }) {
  let state = 'closed';
  let failures = 0;
  let openedAt = 0;

  function checkHalfOpen() {
    if (state === 'open' && Date.now() - openedAt >= resetTimeoutMs) state = 'half-open';
  }
  function getState() { checkHalfOpen(); return { state, failures, failureThreshold, resetTimeoutMs }; }
  function fail() { failures++; if (failures >= failureThreshold) { state = 'open'; openedAt = Date.now(); } }
  function succeed() { failures = 0; state = 'closed'; }
  function execute(fn) {
    checkHalfOpen();
    if (state === 'open') return { executed: false, rejected: true, state };
    try { const value = fn(); succeed(); return { executed: true, rejected: false, value, state: 'closed' }; }
    catch (err) { fail(); return { executed: true, rejected: false, error: err.message, state }; }
  }
  async function executeAsync(fn) {
    checkHalfOpen();
    if (state === 'open') throw new Error(`Circuit breaker is open`);
    try { const value = await fn(); succeed(); return value; }
    catch (err) { fail(); throw err; }
  }
  return { execute, executeAsync, recordSuccess: succeed, recordFailure: fail, getState, getStats: getState };
}
