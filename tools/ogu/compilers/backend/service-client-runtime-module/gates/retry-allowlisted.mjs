import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SR005 — retry-allowlisted
 * Retry logic must only apply to explicitly allowlisted conditions.
 * BAD: retry on ANY error, retry on 4xx, retry POST without idempotency key
 * GOOD: retry on network errors (ECONNRESET, ETIMEDOUT), retry on 429/503 with backoff
 */

// Patterns that indicate dangerous retry conditions
const DANGEROUS_RETRY_PATTERNS = [
  // Retrying on all errors without filtering
  /catch\s*\([^)]*\)\s*\{[^}]*retry/,
  // Retrying 4xx errors (client errors should never be retried)
  /status\s*[<>]=?\s*400.*retry|retry.*4[0-9][0-9]/,
  // POST retry without checking for idempotencyKey
  /method\s*===?\s*['"]POST['"].*retry(?!.*idempotency)/,
];

// Patterns that indicate SAFE retry conditions
const SAFE_RETRY_PATTERNS = [
  /allowedStatuses|retryStatuses|allowedMethods|idempotent/,
  /ECONNRESET|ETIMEDOUT|ENOTFOUND|NetworkError/,
  /status\s*===?\s*(429|503|502|504)/,
  /retryCondition|shouldRetry/,
];

function findRetryFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.ogu', '.git'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/retry|[Hh]ttp[Cc]lient/) && e.name.match(/\.(ts|js)$/)) {
        results.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'client-runtime-spec.json'), 'utf8'));

  if (spec.retryPolicy.maxRetries === 0) {
    return { pass: true, code: 'SR005', message: 'Retry disabled (maxRetries: 0) — gate passes', skipped: true };
  }

  const retryFiles = findRetryFiles(dir);
  if (retryFiles.length === 0) {
    // No retry files found but spec says retries enabled — check if it's handled in httpClient
    return {
      pass: false, code: 'SR005',
      message: 'Retry policy declared in spec (maxRetries > 0) but no retry implementation found',
      detail: 'Create src/lib/http/retry.ts with allowlisted retry conditions'
    };
  }

  const allContent = retryFiles.map(f => readFileSync(f, 'utf8')).join('\n');

  // Check for dangerous patterns
  const dangerousFound = DANGEROUS_RETRY_PATTERNS.filter(p => p.test(allContent));
  if (dangerousFound.length) {
    return {
      pass: false, code: 'SR005',
      message: 'Retry logic applies to non-allowlisted conditions',
      detail: 'Found dangerous retry patterns. Only retry on: 429, 502, 503, 504, ECONNRESET, ETIMEDOUT. Never retry 4xx client errors.'
    };
  }

  // Check for safe patterns
  const safeFound = SAFE_RETRY_PATTERNS.some(p => p.test(allContent));
  if (!safeFound) {
    return {
      pass: false, code: 'SR005',
      message: 'Retry implementation found but no allowlist condition detected',
      detail: 'Add explicit allowedStatuses: [429, 502, 503, 504] or allowedMethods: ["GET", "PUT"] to retry policy'
    };
  }

  return {
    pass: true, code: 'SR005',
    message: `Retry policy uses allowlisted conditions (maxRetries: ${spec.retryPolicy.maxRetries})`
  };
}
