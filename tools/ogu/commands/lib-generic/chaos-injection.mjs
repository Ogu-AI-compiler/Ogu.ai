/**
 * Chaos Injection — failure simulation for resilience testing.
 *
 * Provides injectable failure modes that can be activated
 * during agent execution to test error recovery paths.
 */

export const FAILURE_MODES = {
  'budget-exceeded': {
    description: 'Simulates budget limit exceeded',
    errorCode: 'OGU0601',
    message: 'Budget exceeded: simulated chaos injection',
  },
  'timeout': {
    description: 'Simulates task execution timeout',
    errorCode: 'OGU0602',
    message: 'Timeout: simulated chaos injection — task exceeded time limit',
  },
  'permission-denied': {
    description: 'Simulates governance permission denial',
    errorCode: 'OGU0603',
    message: 'Permission denied: simulated chaos injection',
  },
  'validation-failure': {
    description: 'Simulates output validation failure',
    errorCode: 'OGU0604',
    message: 'Validation failure: simulated chaos injection — output does not match contract',
  },
  'conflict': {
    description: 'Simulates file lock conflict',
    errorCode: 'OGU0605',
    message: 'Conflict: simulated chaos injection — file locked by another agent',
  },
  'transient': {
    description: 'Simulates transient infrastructure failure',
    errorCode: 'OGU0606',
    message: 'Transient failure: simulated chaos injection — temporary infrastructure issue',
  },
};

/**
 * Inject a specific failure mode.
 *
 * @param {string} mode - One of FAILURE_MODES keys
 * @throws {Error} Always throws with the configured error message
 */
export function injectFailure(mode) {
  const config = FAILURE_MODES[mode];
  if (!config) {
    throw new Error(`Unknown failure mode: ${mode}. Available: ${Object.keys(FAILURE_MODES).join(', ')}`);
  }

  const err = new Error(config.message);
  err.code = config.errorCode;
  err.chaosInjected = true;
  throw err;
}

/**
 * Determine if a failure should be injected based on probability.
 *
 * @param {number} probability - 0 to 1
 * @returns {boolean}
 */
export function shouldInject(probability) {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return Math.random() < probability;
}

/**
 * Create a chaos configuration object.
 *
 * @param {object} opts
 * @param {boolean} opts.enabled
 * @param {string[]} opts.modes - Which failure modes to activate
 * @param {number} opts.probability - 0 to 1
 * @param {string[]} [opts.targetPhases] - Only inject during these phases
 * @returns {object}
 */
export function createChaosConfig({ enabled = false, modes = [], probability = 0.1, targetPhases } = {}) {
  return {
    enabled,
    modes: modes.filter(m => m in FAILURE_MODES),
    probability: Math.max(0, Math.min(1, probability)),
    targetPhases: targetPhases || [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Maybe inject a failure based on config.
 * No-op if chaos is disabled or probability doesn't trigger.
 *
 * @param {object} config - From createChaosConfig
 * @param {string} [currentPhase] - Current pipeline phase
 */
export function maybeInject(config, currentPhase) {
  if (!config || !config.enabled) return;
  if (config.targetPhases.length > 0 && !config.targetPhases.includes(currentPhase)) return;
  if (!shouldInject(config.probability)) return;

  // Pick a random mode
  const mode = config.modes[Math.floor(Math.random() * config.modes.length)];
  if (mode) injectFailure(mode);
}
