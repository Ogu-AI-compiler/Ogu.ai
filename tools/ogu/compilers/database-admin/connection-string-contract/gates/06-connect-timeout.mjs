/**
 * Gate: connect-timeout (CSC006)
 * connect_timeout must be declared at the spec level or per environment entry.
 * Without a connect_timeout, applications hang indefinitely when the database
 * is unreachable — causing request pile-ups and cascading failures.
 *
 * connect_timeout is in seconds. Minimum meaningful value: 1. Typical: 5–30.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIN_CONNECT_TIMEOUT = 1;

export async function run({ dir }) {
  const specPath = join(dir, 'connection-string-contract.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CSC006', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CSC006', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const violations = [];

  // Global connect_timeout is acceptable — applies to all entries
  const globalTimeout = spec.connect_timeout;
  const hasGlobalTimeout =
    typeof globalTimeout === 'number' && globalTimeout >= MIN_CONNECT_TIMEOUT;

  if (!Array.isArray(spec.services) || spec.services.length === 0) {
    // No services, but check if global is declared
    if (!hasGlobalTimeout) {
      violations.push('connect_timeout is not declared at the spec level');
    }
  } else {
    for (const service of spec.services) {
      const serviceName = service.name || '(unnamed)';
      const envEntries = Array.isArray(service.environments) ? service.environments : [];

      for (const envEntry of envEntries) {
        const envName = envEntry.env || '(unknown)';
        const envTimeout = envEntry.connect_timeout;
        const hasEnvTimeout = typeof envTimeout === 'number' && envTimeout >= MIN_CONNECT_TIMEOUT;

        // Either the env entry has its own timeout, or the global one covers it
        if (!hasEnvTimeout && !hasGlobalTimeout) {
          violations.push(
            `service "${serviceName}" / env "${envName}": connect_timeout not declared ` +
            '(no global connect_timeout either)'
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CSC006',
      message: `${violations.length} missing connect_timeout declaration(s)`,
      detail:
        violations.join('\n') +
        '\n\nWithout connect_timeout, applications hang indefinitely when the database is unreachable.',
    };
  }

  return {
    pass: true,
    code: 'CSC006',
    message: `connect_timeout declared${hasGlobalTimeout ? ` globally (${globalTimeout}s)` : ' per environment'}`,
  };
}
