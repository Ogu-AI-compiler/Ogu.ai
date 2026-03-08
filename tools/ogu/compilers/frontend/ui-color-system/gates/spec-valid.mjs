import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCS001 — spec-valid: color-system-spec.json exists with required top-level fields */
export async function run({ dir }) {
  const specPath = join(dir, 'color-system-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'UCS001',
      message: 'color-system-spec.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UCS001',
      message: 'color-system-spec.json is not valid JSON',
      detail: err.message,
    };
  }

  const required = ['semanticRoles', 'pairings', 'modes'];
  const missing = required.filter(k => spec[k] === undefined);

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UCS001',
      message: `color-system-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: `Found top-level keys: ${Object.keys(spec).join(', ')}`,
    };
  }

  if (!Array.isArray(spec.semanticRoles) || spec.semanticRoles.length === 0) {
    return {
      pass: false,
      code: 'UCS001',
      message: 'semanticRoles must be a non-empty array',
    };
  }

  if (!Array.isArray(spec.pairings) || spec.pairings.length === 0) {
    return {
      pass: false,
      code: 'UCS001',
      message: 'pairings must be a non-empty array',
    };
  }

  if (!Array.isArray(spec.modes) || spec.modes.length === 0) {
    return {
      pass: false,
      code: 'UCS001',
      message: 'modes must be a non-empty array (e.g. ["light", "dark"])',
    };
  }

  return {
    pass: true,
    code: 'UCS001',
    message: `Spec valid — ${spec.semanticRoles.length} role(s), ${spec.pairings.length} pairing(s), ${spec.modes.length} mode(s)`,
  };
}
