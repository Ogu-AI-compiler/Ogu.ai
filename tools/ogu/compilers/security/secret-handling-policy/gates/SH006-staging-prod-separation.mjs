import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH006 — staging-prod-separation: staging and production secret paths must not overlap */
export async function run({ dir }) {
  const specPath = join(dir, 'secret-handling-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'SH006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SH006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.secrets)) {
    return { pass: true, code: 'SH006', message: 'No secrets array — gate skipped', skipped: true };
  }

  // Only check secrets that declare secret_path with multiple env keys
  const violations = [];
  const STAGING_KEYS = new Set(['staging', 'stage', 'stg', 'pre-prod', 'preprod']);
  const PROD_KEYS = new Set(['prod', 'production', 'prd']);

  for (const secret of spec.secrets) {
    const id = secret.id || '?';
    const paths = secret.secret_path;

    if (!paths || typeof paths !== 'object') continue;

    // Find which keys belong to staging and prod
    const stagingPaths = [];
    const prodPaths = [];

    for (const [envKey, pathValue] of Object.entries(paths)) {
      const keyLower = envKey.toLowerCase();
      if (STAGING_KEYS.has(keyLower)) stagingPaths.push(pathValue);
      if (PROD_KEYS.has(keyLower)) prodPaths.push(pathValue);
    }

    if (stagingPaths.length === 0 || prodPaths.length === 0) continue;

    // Check for overlap between staging and prod paths
    for (const stagePath of stagingPaths) {
      for (const prodPath of prodPaths) {
        if (stagePath === prodPath) {
          violations.push(`Secret "${id}": staging path "${stagePath}" is identical to prod path "${prodPath}" — staging and prod must use separate secret paths`);
        }
        // Check if staging path is a prefix of prod path or vice versa (sharing a namespace)
        if (typeof stagePath === 'string' && typeof prodPath === 'string') {
          const stageNorm = stagePath.replace(/\/$/, '');
          const prodNorm = prodPath.replace(/\/$/, '');
          if (prodNorm.startsWith(stageNorm + '/') || stageNorm.startsWith(prodNorm + '/')) {
            violations.push(`Secret "${id}": staging path "${stagePath}" and prod path "${prodPath}" share a namespace — use separate roots`);
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SH006',
      message: `${violations.length} secret path conflict(s) between staging and production`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'SH006', message: 'Staging and production secret paths are properly separated' };
}
