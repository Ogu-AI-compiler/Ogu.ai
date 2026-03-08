/**
 * Gate: spec-valid (RPP001)
 * Validates that role-privilege-policy.json exists, is valid JSON, and
 * contains all required top-level fields including a roles array.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = ['roles'];
const REQUIRED_ROLE_FIELDS = ['name', 'type', 'privileges'];
const VALID_ROLE_TYPES = ['application', 'migration', 'analytics', 'admin', 'readonly', 'replication'];

export async function run({ dir }) {
  const specPath = join(dir, 'role-privilege-policy.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'RPP001',
      message: 'role-privilege-policy.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'RPP001',
      message: `role-privilege-policy.json is not valid JSON: ${e.message}`,
    };
  }

  if (!Array.isArray(spec.roles) || spec.roles.length === 0) {
    return {
      pass: false,
      code: 'RPP001',
      message: 'roles must be a non-empty array',
    };
  }

  const violations = [];

  for (let i = 0; i < spec.roles.length; i++) {
    const role = spec.roles[i];
    const label = `roles[${i}] ("${role.name || 'unnamed'}")`;

    const missingFields = REQUIRED_ROLE_FIELDS.filter(f => !(f in role));
    if (missingFields.length > 0) {
      violations.push(`${label}: missing required field(s): ${missingFields.join(', ')}`);
    }

    if (role.type && !VALID_ROLE_TYPES.includes(role.type)) {
      violations.push(`${label}: type "${role.type}" is not valid (${VALID_ROLE_TYPES.join(', ')})`);
    }

    if (role.privileges !== undefined && !Array.isArray(role.privileges)) {
      violations.push(`${label}: privileges must be an array`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RPP001',
      message: `${violations.length} role definition error(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RPP001',
    message: `Spec valid — ${spec.roles.length} role(s) defined`,
  };
}
