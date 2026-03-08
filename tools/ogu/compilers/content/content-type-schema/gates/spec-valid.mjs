import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CTS001 — spec-valid: spec file exists, is valid JSON, and has required top-level structure */
export async function run({ dir }) {
  const specPath = join(dir, 'content-type-schema.spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'CTS001',
      message: 'content-type-schema.spec.json not found',
      detail: `Expected file at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'CTS001',
      message: 'content-type-schema.spec.json is not valid JSON',
      detail: err.message,
    };
  }

  if (!Array.isArray(spec.types)) {
    return {
      pass: false,
      code: 'CTS001',
      message: 'spec.types must be an array',
      detail: `Found: ${JSON.stringify(spec.types)}`,
    };
  }

  if (spec.types.length === 0) {
    return {
      pass: false,
      code: 'CTS001',
      message: 'spec.types array is empty — at least one content type required',
    };
  }

  const violations = [];
  for (const type of spec.types) {
    if (!type.id || typeof type.id !== 'string') {
      violations.push(`Content type missing string id: ${JSON.stringify(type).slice(0, 60)}`);
    }
    if (!type.displayName || typeof type.displayName !== 'string') {
      violations.push(`Content type "${type.id || '?'}" missing displayName`);
    }
    if (!Array.isArray(type.fields)) {
      violations.push(`Content type "${type.id || '?'}" missing fields array`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CTS001',
      message: `${violations.length} structural violation(s) in spec`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CTS001',
    message: `Spec valid — ${spec.types.length} content type(s)`,
  };
}
