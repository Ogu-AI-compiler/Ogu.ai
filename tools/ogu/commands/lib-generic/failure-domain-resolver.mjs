/**
 * Failure Domain Resolver — classify and recover from distinct failure domains.
 *
 * Maps error patterns to domains (network, filesystem, governance, llm, unknown)
 * with recovery strategies (retry, escalate, abort, skip).
 */

const DOMAIN_RULES = [
  { pattern: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch.*fail|network/i, domain: 'network', strategy: 'retry' },
  { pattern: /ENOENT|EACCES|EISDIR|EPERM|file|ENAMETOOLONG/i, domain: 'filesystem', strategy: 'abort' },
  { pattern: /BUDGET|budget|quota|limit.*exceed/i, domain: 'governance', strategy: 'escalate' },
  { pattern: /rate.?limit|429|too.?many.?request/i, domain: 'rate_limit', strategy: 'retry' },
  { pattern: /token|context.?length|model|llm|api.?key/i, domain: 'llm', strategy: 'escalate' },
  { pattern: /timeout|DEADLINE/i, domain: 'timeout', strategy: 'retry' },
  { pattern: /conflict|merge|lock/i, domain: 'concurrency', strategy: 'retry' },
];

/**
 * Classify a failure into a domain with a recovery strategy.
 *
 * @param {object} opts - { error: string, operation: string, context?: object }
 * @returns {object} { domain, strategy, confidence }
 */
export function classifyFailure({ error, operation, context }) {
  const errorStr = typeof error === 'string' ? error : String(error);

  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(errorStr)) {
      return {
        domain: rule.domain,
        strategy: rule.strategy,
        confidence: 0.9,
        error: errorStr,
        operation,
      };
    }
  }

  return {
    domain: 'unknown',
    strategy: 'escalate',
    confidence: 0.1,
    error: errorStr,
    operation,
  };
}
