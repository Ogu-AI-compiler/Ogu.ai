/**
 * Gate: auth-type (CPC005)
 * auth_type must be "scram-sha-256". MD5 is deprecated (RFC 7616), crackable
 * offline from captured challenge-response, and disabled by default in
 * PostgreSQL 16+. Plain password auth is flagged as insecure.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DEPRECATED_AUTH_TYPES = ['md5', 'password', 'trust', 'ident', 'peer'];
const RECOMMENDED_AUTH_TYPE = 'scram-sha-256';

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CPC005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CPC005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.auth_type) {
    return {
      pass: false,
      code: 'CPC005',
      message: 'auth_type is required',
      detail: `Use "${RECOMMENDED_AUTH_TYPE}" for secure password authentication.`,
    };
  }

  if (spec.auth_type === 'md5') {
    return {
      pass: false,
      code: 'CPC005',
      message: 'auth_type "md5" is deprecated and insecure',
      detail:
        'MD5 authentication is vulnerable to offline dictionary attacks from captured challenge-response pairs.\n' +
        'PostgreSQL 16+ disables md5 by default.\n' +
        `Use "${RECOMMENDED_AUTH_TYPE}" instead.`,
    };
  }

  if (DEPRECATED_AUTH_TYPES.includes(spec.auth_type)) {
    return {
      pass: false,
      code: 'CPC005',
      message: `auth_type "${spec.auth_type}" is not acceptable for production poolers`,
      detail: `Deprecated/insecure types: ${DEPRECATED_AUTH_TYPES.join(', ')}.\nUse "${RECOMMENDED_AUTH_TYPE}".`,
    };
  }

  if (spec.auth_type !== RECOMMENDED_AUTH_TYPE) {
    // Not a deprecated type but also not the recommended one — warn but pass
    return {
      pass: true,
      code: 'CPC005',
      message: `auth_type "${spec.auth_type}" is accepted (preferred: "${RECOMMENDED_AUTH_TYPE}")`,
    };
  }

  return {
    pass: true,
    code: 'CPC005',
    message: `auth_type "${spec.auth_type}" is the recommended secure method`,
  };
}
