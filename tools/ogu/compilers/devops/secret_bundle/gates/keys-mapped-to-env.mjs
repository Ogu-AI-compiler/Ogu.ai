/**
 * Gate: keys-mapped-to-env (SB002)
 * Cross-artifact gate: when an env-schema-artifact.json exists, validates that every
 * secret's envKey is declared in the env schema AND is marked as secret: true. Without
 * this cross-check, a secret bundle can inject values into env vars that the runtime
 * schema doesn't know about, causing startup validation errors in production.
 *
 * Falls back gracefully when no env-schema-artifact exists (env_schema not yet compiled).
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'secret-bundle-spec.json'), 'utf8'));

  // Multi-path artifact resolution — env_schema may be compiled in a sibling or parent directory
  const candidates = [
    join(dir, 'env-schema-artifact.json'),
    join(dirname(dir), 'env-schema-artifact.json'),
    join(dirname(dir), 'env_schema', 'env-schema-artifact.json'),
  ];
  const artifactPath = candidates.find(p => existsSync(p));

  if (!artifactPath) {
    // No artifact: validate that all secrets have envKey set
    const noEnvKey = spec.secrets.filter(s => !s.envKey || s.envKey.trim() === '');
    if (noEnvKey.length) {
      return {
        pass: false, code: 'SB002',
        message: `${noEnvKey.length} secret(s) missing envKey`,
        detail: {
          violations: noEnvKey.map(s => ({ name: s.name, reason: 'envKey is required on every secret' })),
          hint: 'Add an envKey field to each secret entry mapping it to the runtime environment variable name',
        },
      };
    }
    return {
      pass: true, code: 'SB002',
      message: `All ${spec.secrets.length} secrets have envKey (no env-schema-artifact to cross-validate against)`,
      skipped: true,
    };
  }

  const envSchema       = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const declaredEnvKeys = new Map((envSchema.env_keys || []).map(k => [k.name, k]));
  const violations      = [];

  for (const secret of spec.secrets) {
    if (!declaredEnvKeys.has(secret.envKey)) {
      violations.push({
        secret: secret.name,
        envKey: secret.envKey,
        reason: `envKey "${secret.envKey}" is not declared in the env schema`,
        hint:   'Add this key to env-schema-spec.json with secret: true',
      });
      continue;
    }
    const schemaKey = declaredEnvKeys.get(secret.envKey);
    if (!schemaKey.secret) {
      violations.push({
        secret: secret.name,
        envKey: secret.envKey,
        reason: `env key "${secret.envKey}" is not marked as secret: true in the env schema`,
        hint:   'Update env-schema-spec.json to add secret: true to this key',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SB002',
      message: `${violations.length} key mapping violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'SB002',
    message: `All ${spec.secrets.length} secret keys validated against env schema`,
  };
}
