import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCS002 — semantic-roles-complete: all 7 required semantic roles are declared */

const REQUIRED_ROLES = ['primary', 'secondary', 'destructive', 'success', 'warning', 'info', 'neutral'];

export async function run({ dir }) {
  const specPath = join(dir, 'color-system-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCS002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCS002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.semanticRoles)) {
    return { pass: true, code: 'UCS002', message: 'No semanticRoles array — gate skipped', skipped: true };
  }

  // Each role entry must have an "id" field matching a required role name
  const declaredIds = new Set(spec.semanticRoles.map(r => r.id).filter(Boolean));
  const missing = REQUIRED_ROLES.filter(role => !declaredIds.has(role));

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UCS002',
      message: `${missing.length} required semantic role(s) missing`,
      detail: `Missing: ${missing.join(', ')}\nRequired: ${REQUIRED_ROLES.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'UCS002',
    message: `All ${REQUIRED_ROLES.length} required semantic roles declared`,
  };
}
