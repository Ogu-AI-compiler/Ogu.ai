import { readFileSync } from 'fs';
import { join } from 'path';

// A host/connection string must use an env-var reference, not a hardcoded value.
// Accepted patterns: "${DB_HOST}", "$(DB_HOST)", env:DB_HOST, or the field is absent.
// A literal IP or hostname string (non-empty, no $ or env: prefix) is rejected.
const LITERAL_HOST = /^(?!(?:\$[\({]|\$\{|env:|envFrom:))([a-zA-Z0-9_.-]{3,}|\d{1,3}(?:\.\d{1,3}){3})$/;
const LITERAL_CRED = /(?:password|passwd|secret)\s*["']?\s*[:=]\s*["'][^"'$][^"']{3,}["']/i;

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'connection-pool-spec.json'), 'utf8'));
  const violations = [];

  // Check that host/dsn fields use env references, not literal values
  const hostFields = ['host', 'hostname', 'dsn', 'databaseUrl', 'connectionString'];
  for (const field of hostFields) {
    const val = spec[field];
    if (val && typeof val === 'string' && LITERAL_HOST.test(val.trim())) {
      violations.push(
        `${field}: "${val}" appears to be a literal host/DSN — use an env var reference ` +
        `(e.g. "\${DB_HOST}" or "env:DB_HOST")`
      );
    }
  }

  // Also check nested pool.host if present
  if (spec.pool?.host && LITERAL_HOST.test(String(spec.pool.host).trim())) {
    violations.push(`pool.host: "${spec.pool.host}" appears to be a literal — use an env var reference`);
  }

  // Catch any literal credential values remaining in the spec
  const raw = JSON.stringify(spec);
  if (LITERAL_CRED.test(raw)) {
    violations.push('Literal password/secret value found in spec — use env var references for all credentials');
  }

  if (violations.length) {
    return {
      pass: false, code: 'CP005',
      message: `${violations.length} host/credential ref issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'CP005', message: 'Host and credential fields use env var references' };
}
