/**
 * Gate: auth-tls-valid (CP004)
 * Validates that authType and tlsMode, when declared, use recognised values.
 * An unrecognised authType causes PgBouncer to reject the configuration at
 * startup. An invalid tlsMode silently falls back to the default, which may
 * be weaker than intended.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_AUTH = ['md5', 'scram-sha-256', 'trust', 'peer', 'cert', 'password'];
const VALID_TLS  = ['require', 'prefer', 'disable', 'verify-ca', 'verify-full'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'connection-pool-spec.json'), 'utf8'));
  const violations = [];

  if (spec.authType && !VALID_AUTH.includes(spec.authType)) {
    violations.push({ field: 'authType', received: spec.authType, allowed: VALID_AUTH, reason: `"${spec.authType}" is not a recognised authentication type` });
  }
  if (spec.tlsMode && !VALID_TLS.includes(spec.tlsMode)) {
    violations.push({ field: 'tlsMode', received: spec.tlsMode, allowed: VALID_TLS, reason: `"${spec.tlsMode}" is not a recognised TLS mode` });
  }

  if (violations.length) {
    return {
      pass: false, code: 'CP004',
      message: `${violations.length} auth/TLS issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'CP004', message: 'Auth/TLS modes are valid' };
}
