/**
 * Gate: spec-valid (SB001)
 * Validates that secret-bundle-spec.json exists, is valid JSON, and contains all
 * required fields. Every secret entry must have a name, envKey, and a recognised
 * secret source. This is the entry gate for the secret_bundle compiler.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_SOURCES = ['aws-secrets-manager', 'gcp-secret-manager', 'azure-key-vault', 'vault', 'k8s-secret', 'sealed-secret'];

export async function run({ dir }) {
  const specPath = join(dir, 'secret-bundle-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'SB001',
      message: 'secret-bundle-spec.json not found',
      detail: { hint: 'Create secret-bundle-spec.json with: { secrets: [...], namespace, environments: [] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'SB001',
      message: `secret-bundle-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['secrets', 'namespace', 'environments'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'SB001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required shape: { secrets: [{ name, envKey, source, path }], namespace: string, environments: string[], rotationPolicy?: string }',
      },
    };
  }

  if (!Array.isArray(spec.secrets) || spec.secrets.length === 0) {
    return {
      pass: false, code: 'SB001',
      message: 'secrets must be a non-empty array',
      detail: { hint: 'Add at least one secret entry' },
    };
  }

  const invalid = spec.secrets.filter(s => !s.name || !s.envKey || !VALID_SOURCES.includes(s.source));
  if (invalid.length) {
    return {
      pass: false, code: 'SB001',
      message: `${invalid.length} invalid secret entry(ies)`,
      detail: {
        violations: invalid.map(s => ({
          name:   s.name || '(unnamed)',
          source: s.source,
          reason: !s.name ? 'missing name' : !s.envKey ? 'missing envKey' : `invalid source "${s.source}"`,
        })),
        allowedSources: VALID_SOURCES,
        hint: 'Each secret needs: name, envKey, source (one of allowedSources), path',
      },
    };
  }

  return {
    pass: true, code: 'SB001',
    message: `secret-bundle-spec.json valid — ${spec.secrets.length} secrets, namespace: ${spec.namespace}`,
  };
}
