import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DS007 — typed-results
 * Service methods must return typed success AND typed failure — not void, not throws-only.
 * Pattern: Result<T, E> | Either<Error, T> | { success: true, data: T } | { success: false, error: E }
 */

const TYPED_RESULT_PATTERNS = [
  /Result<[^>]+>/,
  /Either<[^>]+>/,
  /Promise<\{[^}]*success[^}]*\}>/,
  /ServiceResult/,
  /DomainResult/,
  /\| \w*Error/,
  /Promise<\w+\s*\|\s*\w*Error>/,
];

function getServiceFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.service\.ts$/) && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'service-spec.json'), 'utf8'));

  const serviceFiles = getServiceFiles(dir);
  if (serviceFiles.length === 0) {
    return { pass: true, code: 'DS007', message: 'No service files found — typed-results gate skipped', skipped: true };
  }

  const allContent = serviceFiles.map(f => readFileSync(f, 'utf8')).join('\n');

  // Check for any void returns on non-trivial methods
  const voidMethodPattern = /async\s+\w+\s*\([^)]*\)\s*:\s*Promise<void>/g;
  const voidMethods = allContent.match(voidMethodPattern) || [];

  // Allow void for fire-and-forget notifications and logging
  const nonTrivialVoid = voidMethods.filter(m =>
    !m.toLowerCase().includes('notify') &&
    !m.toLowerCase().includes('log') &&
    !m.toLowerCase().includes('emit')
  );

  if (nonTrivialVoid.length > 0) {
    return {
      pass: false, code: 'DS007',
      message: `${nonTrivialVoid.length} service method(s) return Promise<void>`,
      detail: nonTrivialVoid.map(m => `Found: ${m}`).join('\n') + '\n\nUse Result<T, E> or discriminated union: Promise<User | UserNotFoundError>'
    };
  }

  // Check that at least some typed result pattern exists
  const hasTypedResults = TYPED_RESULT_PATTERNS.some(p => p.test(allContent));
  if (!hasTypedResults && spec.useCases.length > 0) {
    return {
      pass: false, code: 'DS007',
      message: 'No typed result pattern found in service',
      detail: 'Add typed return types: Promise<User | UserNotFoundError> or Result<User, UserError>'
    };
  }

  return { pass: true, code: 'DS007', message: 'Service methods return typed success and failure results' };
}
