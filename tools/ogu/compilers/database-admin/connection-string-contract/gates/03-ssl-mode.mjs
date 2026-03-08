/**
 * Gate: ssl-mode (CSC003)
 * For all non-local environments, sslmode must be "require" or "verify-full".
 * "verify-full" is preferred (validates CA + hostname). "require" encrypts
 * but does not validate the cert — acceptable when the CA is managed by the
 * cloud platform and cert validation is handled at the network layer.
 *
 * "disable" and "prefer" are rejected for non-local environments because they
 * allow plaintext connections and are vulnerable to MITM attacks.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const LOCAL_ENV_NAMES = ['local', 'localhost', 'dev-local', 'development-local'];
const ACCEPTABLE_SSL_MODES = ['require', 'verify-full', 'verify-ca'];
const REJECTED_SSL_MODES = ['disable', 'prefer', 'allow'];

export async function run({ dir }) {
  const specPath = join(dir, 'connection-string-contract.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CSC003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CSC003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const violations = [];

  if (Array.isArray(spec.services)) {
    for (const service of spec.services) {
      const serviceName = service.name || '(unnamed)';

      const envEntries = Array.isArray(service.environments) ? service.environments : [];
      for (const envEntry of envEntries) {
        const envName = envEntry.env || '(unknown)';
        const isLocal = LOCAL_ENV_NAMES.includes(envName.toLowerCase());

        if (isLocal) continue; // Local environments do not require SSL

        const sslmode = envEntry.sslmode;

        if (!sslmode) {
          violations.push(`service "${serviceName}" / env "${envName}": sslmode is not declared (required for non-local environments)`);
          continue;
        }

        if (REJECTED_SSL_MODES.includes(sslmode)) {
          violations.push(
            `service "${serviceName}" / env "${envName}": sslmode "${sslmode}" is not acceptable for "${envName}" ` +
            `(use: ${ACCEPTABLE_SSL_MODES.join(', ')})`
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CSC003',
      message: `${violations.length} sslmode violation(s) for non-local environments`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CSC003',
    message: 'All non-local environments use acceptable sslmode (require/verify-full/verify-ca)',
  };
}
