/**
 * Failure Strategy — failure domain definition & resilience mapping.
 */

export const RECOVERY_ACTIONS = ['retry', 'failover', 'escalate', 'ignore', 'circuit_break'];

/**
 * Create a failure strategy manager.
 *
 * @returns {object} Strategy with defineDomain/recordFailure/getRecoveryAction/getDomainStatus/listDomains
 */
export function createFailureStrategy() {
  const domains = new Map(); // name → { config, failures[] }

  function defineDomain(name, config) {
    domains.set(name, {
      config: { fallback: 'retry', maxRetries: 3, ...config },
      failures: [],
    });
  }

  function recordFailure(name, details) {
    const domain = domains.get(name);
    if (!domain) throw new Error(`Domain "${name}" not defined`);
    domain.failures.push({
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  function getRecoveryAction(name) {
    const domain = domains.get(name);
    if (!domain) throw new Error(`Domain "${name}" not defined`);
    const { config, failures } = domain;
    if (failures.length > config.maxRetries) {
      return { action: 'escalate', reason: 'max retries exceeded' };
    }
    return { action: config.fallback, retriesRemaining: config.maxRetries - failures.length };
  }

  function getDomainStatus(name) {
    const domain = domains.get(name);
    if (!domain) throw new Error(`Domain "${name}" not defined`);
    return {
      name,
      failureCount: domain.failures.length,
      maxRetries: domain.config.maxRetries,
      exhausted: domain.failures.length > domain.config.maxRetries,
    };
  }

  function listDomains() {
    return Array.from(domains.keys());
  }

  return { defineDomain, recordFailure, getRecoveryAction, getDomainStatus, listDomains };
}
