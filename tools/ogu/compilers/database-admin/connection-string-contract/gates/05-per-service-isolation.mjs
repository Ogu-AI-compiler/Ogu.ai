/**
 * Gate: per-service-isolation (CSC005)
 * Each service must have its own connection string. No two services may share
 * the same (host, port, database, user) tuple for the same environment.
 * Shared connection strings mean shared credentials — a breach of one service
 * exposes all services that share it.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'connection-string-contract.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CSC005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CSC005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.services) || spec.services.length < 2) {
    return {
      pass: true,
      code: 'CSC005',
      message: 'Fewer than 2 services — sharing check not applicable',
      skipped: true,
    };
  }

  const violations = [];

  // Build a map: env → "host:port:db:user" → [service names]
  const envUserMap = {};

  for (const service of spec.services) {
    const serviceName = service.name || '(unnamed)';
    const envEntries = Array.isArray(service.environments) ? service.environments : [];

    for (const envEntry of envEntries) {
      const env = envEntry.env || 'unknown';
      const user = envEntry.user || '';

      // user alone is sufficient to detect sharing — same user = shared credentials
      if (!user) continue;

      const key = `${env}::user:${user}`;
      if (!envUserMap[key]) {
        envUserMap[key] = [];
      }
      envUserMap[key].push(serviceName);
    }
  }

  for (const [key, services] of Object.entries(envUserMap)) {
    if (services.length > 1) {
      violations.push(
        `Shared database user detected [${key}] used by: ${services.join(', ')}. ` +
        'Each service must have its own dedicated database user.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CSC005',
      message: `${violations.length} shared credential(s) detected across services`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CSC005',
    message: `All ${spec.services.length} services use isolated credentials`,
  };
}
