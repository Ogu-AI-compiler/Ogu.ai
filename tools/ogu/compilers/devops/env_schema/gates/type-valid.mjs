/**
 * Gate: type-valid (ES003)
 * Validates that every env key declares a recognised type and explicitly specifies
 * whether it is required or optional (via a default value). Keys that are neither
 * required nor defaulted are ambiguous — the runtime cannot know what to do when
 * the variable is absent.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_TYPES = ['string', 'number', 'boolean', 'url', 'port', 'email', 'json', 'base64'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'env-schema-spec.json'), 'utf8'));
  const violations = [];

  for (const key of spec.envKeys) {
    if (!VALID_TYPES.includes(key.type)) {
      violations.push({ name: key.name, field: 'type', value: key.type, reason: `unknown type — must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (key.required === undefined && key.default === undefined) {
      violations.push({ name: key.name, field: 'required/default', value: null, reason: 'must declare required: true or provide a default value — ambiguous optionality' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'ES003',
      message: `${violations.length} type/optionality violation(s)`,
      detail: {
        violations,
        allowedTypes: VALID_TYPES,
        hint: 'Each key needs a valid type and either required: true or a default value',
      },
    };
  }

  return {
    pass: true, code: 'ES003',
    message: `All ${spec.envKeys.length} keys have valid types and declared optionality`,
  };
}
