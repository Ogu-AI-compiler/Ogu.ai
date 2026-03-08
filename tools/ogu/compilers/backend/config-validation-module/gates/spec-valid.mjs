import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'config-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'CV001', message: 'config-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'CV001', message: `config-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['envKeys', 'unknownKeyPolicy'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'CV001',
      message: `config-spec.json missing required fields: ${missing.join(', ')}`,
      detail: 'Required shape: { envKeys: [{name, type, required, default?, secret?, description}], unknownKeyPolicy: "reject"|"ignore" }'
    };
  }

  if (!Array.isArray(spec.envKeys) || spec.envKeys.length === 0) {
    return { pass: false, code: 'CV001', message: 'envKeys must be a non-empty array' };
  }

  const validPolicies = ['reject', 'ignore'];
  if (!validPolicies.includes(spec.unknownKeyPolicy)) {
    return {
      pass: false, code: 'CV001',
      message: `unknownKeyPolicy must be "reject" or "ignore", got: "${spec.unknownKeyPolicy}"`
    };
  }

  const validTypes = ['string', 'number', 'boolean', 'url', 'port', 'email'];
  const invalid = spec.envKeys.filter(k => !k.name || !validTypes.includes(k.type));
  if (invalid.length) {
    return {
      pass: false, code: 'CV001',
      message: `Invalid envKey entries: ${invalid.map(k => k.name || '(unnamed)').join(', ')}`,
      detail: `Each envKey needs: name (string) and type (${validTypes.join('|')})`
    };
  }

  return { pass: true, code: 'CV001', message: `config-spec.json valid — ${spec.envKeys.length} keys, policy: ${spec.unknownKeyPolicy}` };
}
