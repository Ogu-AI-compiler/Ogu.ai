/**
 * Gate: spec-valid (ES001)
 * Validates the env-schema-spec.json file exists, is parseable JSON, and contains
 * all required top-level fields with correct types. This is the entry gate — all
 * downstream env_schema gates assume spec-valid has already passed.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_TYPES   = ['string', 'number', 'boolean', 'url', 'port', 'email', 'json', 'base64'];
const VALID_POLICIES = ['reject', 'ignore'];

export async function run({ dir }) {
  const specPath = join(dir, 'env-schema-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'ES001',
      message: 'env-schema-spec.json not found',
      detail: { hint: 'Create env-schema-spec.json with: { envKeys: [...], unknownKeyPolicy: "reject"|"ignore" }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'ES001',
      message: `env-schema-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error — run `node -e "JSON.parse(require(\'fs\').readFileSync(\'env-schema-spec.json\',\'utf8\'))"` to locate it' },
    };
  }

  const missing = ['envKeys', 'unknownKeyPolicy'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'ES001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required shape: { envKeys: [{ name, type, required?, default?, secret?, description? }], unknownKeyPolicy: "reject"|"ignore" }',
      },
    };
  }

  if (!Array.isArray(spec.envKeys) || spec.envKeys.length === 0) {
    return {
      pass: false, code: 'ES001',
      message: 'envKeys must be a non-empty array',
      detail: { hint: 'Declare at least one env key in the envKeys array' },
    };
  }

  if (!VALID_POLICIES.includes(spec.unknownKeyPolicy)) {
    return {
      pass: false, code: 'ES001',
      message: `unknownKeyPolicy must be "reject" or "ignore", got: "${spec.unknownKeyPolicy}"`,
      detail: { allowedValues: VALID_POLICIES, hint: 'Use "reject" to fail on unknown env vars, "ignore" to allow them silently' },
    };
  }

  const invalid = spec.envKeys.filter(k => !k.name || !VALID_TYPES.includes(k.type));
  if (invalid.length) {
    return {
      pass: false, code: 'ES001',
      message: `${invalid.length} invalid envKey entry(ies)`,
      detail: {
        violations: invalid.map(k => ({ name: k.name || '(unnamed)', type: k.type, reason: !k.name ? 'missing name' : `invalid type "${k.type}"` })),
        allowedTypes: VALID_TYPES,
        hint: 'Each key needs: name (string) and type (one of the allowedTypes)',
      },
    };
  }

  return {
    pass: true, code: 'ES001',
    message: `env-schema-spec.json valid — ${spec.envKeys.length} keys, policy: ${spec.unknownKeyPolicy}`,
  };
}
