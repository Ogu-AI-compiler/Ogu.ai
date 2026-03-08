/**
 * Gate: spec-valid (CSC001)
 * Validates that connection-string-contract.json exists, is valid JSON, and
 * contains all required top-level fields.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = ['environments', 'services', 'format'];
const VALID_FORMATS = ['uri', 'dsn'];

export async function run({ dir }) {
  const specPath = join(dir, 'connection-string-contract.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'CSC001',
      message: 'connection-string-contract.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'CSC001',
      message: `connection-string-contract.json is not valid JSON: ${e.message}`,
    };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in spec));
  if (missing.length > 0) {
    return {
      pass: false,
      code: 'CSC001',
      message: `Missing required field(s): ${missing.join(', ')}`,
      detail: `Required: ${REQUIRED_FIELDS.join(', ')}`,
    };
  }

  const violations = [];

  if (!Array.isArray(spec.environments) || spec.environments.length === 0) {
    violations.push('environments must be a non-empty array');
  }

  if (!Array.isArray(spec.services) || spec.services.length === 0) {
    violations.push('services must be a non-empty array');
  }

  if (!VALID_FORMATS.includes(spec.format)) {
    violations.push(`format must be "uri" or "dsn", got: "${spec.format}"`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CSC001',
      message: `Spec has ${violations.length} field-level error(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CSC001',
    message: `Spec valid — ${spec.environments.length} environment(s), ${spec.services.length} service(s), format: ${spec.format}`,
  };
}
