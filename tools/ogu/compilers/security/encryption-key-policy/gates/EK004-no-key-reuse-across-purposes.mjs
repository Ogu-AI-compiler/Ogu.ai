import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** EK004 — no-key-reuse-across-purposes: each key must have a single, specific purpose */
export async function run({ dir }) {
  const specPath = join(dir, 'encryption-key-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'EK004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'EK004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.keys) || spec.keys.length === 0) {
    return { pass: true, code: 'EK004', message: 'No keys — gate skipped', skipped: true };
  }

  const violations = [];

  for (const key of spec.keys) {
    const id = key.id || '?';

    // purpose must be a single string (not an array or compound value)
    if (!key.purpose || typeof key.purpose !== 'string') {
      violations.push(`Key "${id}": purpose must be a non-empty string declaring the single use of this key`);
      continue;
    }

    // Detect compound purposes — a key shared across multiple uses
    const COMPOUND_INDICATORS = [' and ', ' & ', ',', ';', '/'];
    for (const indicator of COMPOUND_INDICATORS) {
      if (key.purpose.includes(indicator)) {
        violations.push(`Key "${id}": purpose "${key.purpose}" declares multiple uses — each key must have exactly one purpose`);
        break;
      }
    }

    // Detect wildcard purposes
    if (key.purpose.toLowerCase() === 'all' || key.purpose.toLowerCase() === 'general' || key.purpose === '*') {
      violations.push(`Key "${id}": purpose "${key.purpose}" is too broad — declare a specific purpose (e.g. "user-data-at-rest-encryption")`);
    }

    // Detect if uses array has multiple values (alternative representation)
    if (Array.isArray(key.uses) && key.uses.length > 1) {
      violations.push(`Key "${id}": uses array has ${key.uses.length} entries — split into separate keys, one per purpose`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'EK004',
      message: `${violations.length} key(s) declared with multiple or ambiguous purposes`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'EK004', message: `All ${spec.keys.length} key(s) have a single declared purpose` };
}
