import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH002 — no-env-vars-prod: production secrets must not be stored as plain env vars */
export async function run({ dir }) {
  const specPath = join(dir, 'secret-handling-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'SH002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SH002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.secrets)) {
    return { pass: true, code: 'SH002', message: 'No secrets array — gate skipped', skipped: true };
  }

  const PROD_ENVS = new Set(['prod', 'production']);
  const violations = [];

  for (const secret of spec.secrets) {
    const id = secret.id || '?';
    const envs = Array.isArray(secret.environments) ? secret.environments : [];
    const isInProd = envs.some(e => PROD_ENVS.has(String(e).toLowerCase()));

    if (!isInProd) continue;

    const backend = String(secret.storage_backend || '').toLowerCase();
    if (backend === 'env_var' || backend === 'environment_variable' || backend === 'env') {
      violations.push(`Secret "${id}" uses storage_backend "${secret.storage_backend}" in prod — use Vault, AWS Secrets Manager, or GCP Secret Manager instead`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SH002',
      message: `${violations.length} secret(s) use env_var storage in production`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'SH002', message: 'No env_var storage in production environments' };
}
