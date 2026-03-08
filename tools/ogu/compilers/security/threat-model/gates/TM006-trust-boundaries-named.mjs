import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM006 — trust-boundaries-named: trust boundaries must be declared and non-empty */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TM006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.trust_boundaries)) {
    return { pass: true, code: 'TM006', message: 'No trust_boundaries array — gate skipped', skipped: true };
  }

  if (spec.trust_boundaries.length === 0) {
    return {
      pass: false,
      code: 'TM006',
      message: 'trust_boundaries array is empty — every feature must declare at least one trust boundary',
      detail: 'Add at least one trust boundary (e.g. "internet-to-api", "api-to-database", "user-to-admin")',
    };
  }

  const violations = [];

  for (const boundary of spec.trust_boundaries) {
    const id = boundary.id || boundary.name || '?';

    if (!boundary.name && !boundary.id) {
      violations.push('A trust boundary is missing both "id" and "name" fields');
      continue;
    }

    if (!boundary.from || !boundary.to) {
      violations.push(`Trust boundary "${id}": must declare "from" and "to" to define the crossing direction`);
    }

    if (typeof boundary.from === 'string' && typeof boundary.to === 'string') {
      if (boundary.from.toLowerCase() === boundary.to.toLowerCase()) {
        violations.push(`Trust boundary "${id}": "from" and "to" are the same — a trust boundary must cross between different trust zones`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM006',
      message: `${violations.length} trust boundary(ies) are invalid or incomplete`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'TM006', message: `${spec.trust_boundaries.length} trust boundary(ies) declared and valid` };
}
