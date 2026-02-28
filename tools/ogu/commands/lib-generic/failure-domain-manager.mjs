/**
 * Failure Domain Manager — map operations to domains with resilience strategies.
 */

/**
 * Create a failure domain manager.
 *
 * @returns {object} Manager with defineDomain/handleFailure/listDomains
 */
export function createFailureDomainManager() {
  const domains = new Map(); // name → { strategy, maxRetries, circuitBreaker }

  function defineDomain(name, { strategy = 'retry', maxRetries = 3, circuitBreaker = false }) {
    domains.set(name, { name, strategy, maxRetries, circuitBreaker });
  }

  function listDomains() {
    return Array.from(domains.keys());
  }

  function handleFailure(domainName, { error, attempt = 1 }) {
    const domain = domains.get(domainName);
    if (!domain) {
      return { action: 'abort', reason: `Unknown domain: ${domainName}` };
    }

    if (domain.strategy === 'retry' && attempt <= domain.maxRetries) {
      return {
        action: 'retry',
        attempt,
        maxRetries: domain.maxRetries,
        domain: domainName,
      };
    }

    if (domain.strategy === 'retry' && attempt > domain.maxRetries) {
      return {
        action: 'escalate',
        reason: `Max retries (${domain.maxRetries}) exceeded`,
        domain: domainName,
      };
    }

    if (domain.strategy === 'escalate') {
      return {
        action: 'escalate',
        reason: error,
        domain: domainName,
      };
    }

    return { action: 'abort', reason: `Unhandled strategy: ${domain.strategy}` };
  }

  return { defineDomain, handleFailure, listDomains };
}
