/**
 * Gate: no-secret-default (ES005)
 * Ensures that keys marked secret: true have no literal default values and are not
 * committed with real values in any .env file (excluding .env.example). A secret
 * with a literal default is effectively a hardcoded credential — it will end up in
 * source control and container image layers.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ENV_FILE_PATTERNS = ['.env', '.env.example', '.env.local', '.env.production', '.env.staging'];

function findEnvFiles(dir) {
  const results = [];
  try {
    for (const e of readdirSync(dir)) {
      if (ENV_FILE_PATTERNS.some(p => e === p) || e.startsWith('.env.')) {
        results.push(join(dir, e));
      }
    }
  } catch { /* dir not readable — skip */ }
  return results;
}

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'env-schema-spec.json'), 'utf8'));
  const secretKeys = spec.envKeys.filter(k => k.secret === true);

  if (secretKeys.length === 0) {
    return { pass: true, code: 'ES005', message: 'No secret-marked keys — gate skipped', skipped: true };
  }

  const violations = [];

  // Literal default in spec
  for (const key of secretKeys) {
    if (key.default !== undefined && key.default !== '' && key.default !== null) {
      violations.push({
        source: 'spec',
        name:   key.name,
        reason: `secret key has a literal default value: "${key.default}" — defaults for secrets must be empty or omitted`,
      });
    }
  }

  // Committed env files
  const secretKeyNames = new Set(secretKeys.map(k => k.name));
  for (const filePath of findEnvFiles(dir)) {
    if (filePath.endsWith('.example')) continue; // placeholders in .env.example are expected
    const lines = readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const [keyPart, ...rest] = trimmed.split('=');
      const keyName = keyPart.trim();
      const value   = rest.join('=').trim();
      if (secretKeyNames.has(keyName) && value && value !== '""' && value !== "''" && !value.startsWith('$')) {
        violations.push({
          source: `${filePath.replace(dir + '/', '')}:${i + 1}`,
          name:   keyName,
          reason: `secret key has a literal value in a committed env file`,
        });
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'ES005',
      message: `${violations.length} secret exposure(s) found`,
      detail: {
        violations,
        hint: 'Remove literal values from secret keys. Inject secrets at runtime via k8s Secrets or Vault — never commit them.',
      },
    };
  }

  return {
    pass: true, code: 'ES005',
    message: `All ${secretKeys.length} secret key(s) have no literal defaults or committed values`,
  };
}
