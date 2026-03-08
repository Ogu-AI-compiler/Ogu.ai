/**
 * Gate: spec-valid (VP001)
 * Validates vault-policy-spec.json exists, is valid JSON, and declares all required
 * fields. Every path entry must have a path and capabilities array. This gate is the
 * prerequisite for all other vault_policy gates.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'vault-policy-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'VP001',
      message: 'vault-policy-spec.json not found',
      detail: { hint: 'Create vault-policy-spec.json with: { name, paths: [{ path, capabilities: [] }], roles: [] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'VP001',
      message: `vault-policy-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['name', 'paths', 'roles'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'VP001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required: { name, paths: [{ path, capabilities: [] }], roles: [{ name, serviceAccount?, namespace? }], allowedPrefixes?: [] }',
      },
    };
  }

  if (!Array.isArray(spec.paths) || spec.paths.length === 0) {
    return {
      pass: false, code: 'VP001',
      message: 'paths must be a non-empty array',
      detail: { hint: 'Add at least one path entry: { path: "secret/data/my-app/*", capabilities: ["read"] }' },
    };
  }

  const malformed = spec.paths.filter(p => !p.path || !Array.isArray(p.capabilities) || p.capabilities.length === 0);
  if (malformed.length) {
    return {
      pass: false, code: 'VP001',
      message: `${malformed.length} malformed path entry(ies)`,
      detail: {
        violations: malformed.map(p => ({ path: p.path || '(missing)', reason: !p.path ? 'missing path' : 'missing or empty capabilities array' })),
        hint: 'Each entry needs: { path: string, capabilities: ["read"|"create"|...] }',
      },
    };
  }

  return {
    pass: true, code: 'VP001',
    message: `vault-policy-spec.json valid — "${spec.name}", ${spec.paths.length} paths, ${spec.roles.length} roles`,
  };
}
