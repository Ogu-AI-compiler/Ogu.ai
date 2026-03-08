import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SC007 — resilience-declared
 * Every service client must declare at least one resilience strategy:
 * - Retry (p-retry, axios-retry, retry logic, spec.retry)
 * - Circuit breaker (opossum, cockatiel, spec.circuitBreaker)
 * - Timeout (AbortSignal.timeout, AbortController, signal option, spec.timeoutMs)
 *
 * Timeout alone is acceptable (it's the minimum). Retry without timeout is not.
 */

const RESILIENCE_PATTERNS = [
  { name: 'retry', pattern: /\b(?:p-retry|pRetry|axiosRetry|axios-retry|retry\s*\(|retryPolicy|maxRetries|retries\s*:)\b/i },
  { name: 'circuit-breaker', pattern: /\b(?:opossum|CircuitBreaker|cockatiel|circuitBreaker|openState)\b/i },
  { name: 'timeout-signal', pattern: /AbortSignal\s*\.\s*timeout|AbortController|signal\s*:\s*(?:AbortSignal|controller\.signal)/i },
  { name: 'timeout-option', pattern: /timeout\s*:\s*\d+/i },
];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'service-client-spec.json'), 'utf8'));

  // Check spec-level declarations
  const specDeclared = [];
  if (spec.retry) specDeclared.push('retry (spec)');
  if (spec.circuitBreaker) specDeclared.push('circuit-breaker (spec)');
  if (spec.timeoutMs) specDeclared.push(`timeout ${spec.timeoutMs}ms (spec)`);

  // Check code patterns
  const files = collectFiles(dir);
  const found = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const { name, pattern } of RESILIENCE_PATTERNS) {
      if (pattern.test(content) && !found.includes(name)) {
        found.push(name);
      }
    }
  }

  const allFound = [...new Set([...specDeclared, ...found])];

  if (allFound.length === 0) {
    return {
      pass: false, code: 'SC007',
      message: 'No resilience strategy declared — add retry, circuit-breaker, or timeout',
      detail: 'Add to spec: { timeoutMs: 5000, retry: { maxAttempts: 3 } } and implement in code'
    };
  }

  // Retry without timeout is a smell
  const hasRetry = found.some(f => f.includes('retry')) || specDeclared.some(s => s.includes('retry'));
  const hasTimeout = found.some(f => f.includes('timeout')) || specDeclared.some(s => s.includes('timeout'));
  if (hasRetry && !hasTimeout) {
    return {
      pass: false, code: 'SC007',
      message: 'Retry declared but no timeout — retry without timeout can hang indefinitely',
      detail: 'Add AbortSignal.timeout or timeoutMs to each request'
    };
  }

  return {
    pass: true, code: 'SC007',
    message: `Resilience declared: ${allFound.join(', ')}`
  };
}
