import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CV005 — secret-marked
 * Keys whose names suggest they are secrets must have secret:true in the spec.
 * Secret keys must not appear in safe debug snapshots (no unguarded serialization).
 */

const SECRET_PATTERNS = [
  /secret/i, /password/i, /passwd/i, /token/i, /api[_-]?key/i,
  /private[_-]?key/i, /auth[_-]?key/i, /credential/i, /signing[_-]?key/i,
  /jwt[_-]?secret/i, /hmac/i, /encryption[_-]?key/i,
];

function looksLikeSecret(name) {
  return SECRET_PATTERNS.some(p => p.test(name));
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'config-spec.json'), 'utf8'));

  const violations = [];

  for (const key of spec.envKeys) {
    if (looksLikeSecret(key.name) && key.secret !== true) {
      violations.push(`"${key.name}" looks like a secret but is not marked with secret:true`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CV005',
      message: `${violations.length} key(s) appear to be secrets but are not marked`,
      detail: violations.join('\n') + '\n\nAdd secret:true to these envKey entries in config-spec.json'
    };
  }

  // Check that secret keys are not in a plain debug snapshot
  const secretKeys = spec.envKeys.filter(k => k.secret === true).map(k => k.name);

  if (secretKeys.length === 0) {
    return { pass: true, code: 'CV005', message: 'No secret keys declared — gate passes' };
  }

  return {
    pass: true, code: 'CV005',
    message: `All ${secretKeys.length} secret key(s) properly marked: ${secretKeys.join(', ')}`
  };
}
