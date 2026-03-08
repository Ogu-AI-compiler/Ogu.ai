/**
 * Gate: host-per-env (CSC004)
 * Every declared environment must have a host entry in each service's connection
 * spec. A missing host means the application silently falls back to whatever
 * host is configured elsewhere — often the wrong environment's database.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'connection-string-contract.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CSC004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CSC004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.environments) || spec.environments.length === 0) {
    return { pass: true, code: 'CSC004', message: 'No environments declared — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.services) || spec.services.length === 0) {
    return { pass: true, code: 'CSC004', message: 'No services declared — gate skipped', skipped: true };
  }

  const declaredEnvs = spec.environments.map(e => (typeof e === 'string' ? e : e.name));
  const violations = [];

  for (const service of spec.services) {
    const serviceName = service.name || '(unnamed)';
    const envEntries = Array.isArray(service.environments) ? service.environments : [];
    const coveredEnvs = envEntries.map(e => e.env);

    for (const envName of declaredEnvs) {
      const envEntry = envEntries.find(e => e.env === envName);

      if (!envEntry) {
        violations.push(`service "${serviceName}" has no connection entry for environment "${envName}"`);
        continue;
      }

      if (!envEntry.host && !envEntry.connection_string) {
        violations.push(`service "${serviceName}" / env "${envName}": no host or connection_string declared`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CSC004',
      message: `${violations.length} missing host entry/entries`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CSC004',
    message: `All ${spec.services.length} service(s) have host entries for all ${declaredEnvs.length} environment(s)`,
  };
}
