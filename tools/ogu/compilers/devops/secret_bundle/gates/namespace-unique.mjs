/**
 * Gate: namespace-unique (SB003)
 * Ensures there are no duplicate secret names within the same namespace+environment
 * combination. Duplicates cause non-deterministic secret resolution — whichever entry
 * the secret manager returns last silently wins.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'secret-bundle-spec.json'), 'utf8'));
  const seen       = new Set();
  const violations = [];

  for (const env of spec.environments) {
    for (const secret of spec.secrets) {
      const key = `${spec.namespace}/${env}/${secret.name}`;
      if (seen.has(key)) {
        violations.push({
          secret:    secret.name,
          namespace: spec.namespace,
          env,
          reason:    `duplicate in namespace "${spec.namespace}" for environment "${env}"`,
        });
      }
      seen.add(key);
    }
  }

  if (spec.namespacePerEnv) {
    const nsEnvPairs = new Set();
    for (const [env, ns] of Object.entries(spec.namespacePerEnv)) {
      const pair = `${ns}/${env}`;
      if (nsEnvPairs.has(pair)) {
        violations.push({ namespace: ns, env, reason: `duplicate namespace "${ns}" for environment "${env}"` });
      }
      nsEnvPairs.add(pair);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SB003',
      message: `${violations.length} namespace uniqueness violation(s)`,
      detail: {
        violations,
        hint: 'Each secret name must be unique within its namespace+environment combination. Remove or rename duplicates.',
      },
    };
  }

  return {
    pass: true, code: 'SB003',
    message: `Namespace "${spec.namespace}" is unique across ${spec.environments.length} environment(s)`,
  };
}
