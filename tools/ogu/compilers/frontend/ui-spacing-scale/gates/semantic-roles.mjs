import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * USS003 — semantic-roles: semantic spacing roles declared for inset, stack, inline, gap categories.
 *
 * Spec can declare semantic roles in two ways:
 * 1. spec.semanticRoles: { "inset-sm": "{spacing.2}", "stack-md": "{spacing.4}", ... }
 * 2. Each step has a role field: { "id": "2", "value": "8px", "role": "inset-sm" }
 */

const REQUIRED_CATEGORIES = ['inset', 'stack', 'inline', 'gap'];

export async function run({ dir }) {
  const specPath = join(dir, 'spacing-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USS003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USS003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // Collect all declared semantic role names
  const declaredRoleNames = new Set();

  // Source 1: explicit semanticRoles object
  if (spec.semanticRoles && typeof spec.semanticRoles === 'object') {
    for (const key of Object.keys(spec.semanticRoles)) {
      declaredRoleNames.add(key);
    }
  }

  // Source 2: role field on individual steps
  if (Array.isArray(spec.steps)) {
    for (const step of spec.steps) {
      if (step.role) {
        declaredRoleNames.add(String(step.role));
      }
      // Also check roles array on a step
      if (Array.isArray(step.roles)) {
        for (const r of step.roles) {
          declaredRoleNames.add(String(r));
        }
      }
    }
  }

  if (declaredRoleNames.size === 0) {
    return {
      pass: false,
      code: 'USS003',
      message: 'No semantic spacing roles declared',
      detail: 'Add a semanticRoles object or role fields on steps: inset-*, stack-*, inline-*, gap-*',
    };
  }

  // Check that at least one role exists per required category
  const missingCategories = REQUIRED_CATEGORIES.filter(cat => {
    return ![...declaredRoleNames].some(name => name.startsWith(cat));
  });

  if (missingCategories.length > 0) {
    return {
      pass: false,
      code: 'USS003',
      message: `${missingCategories.length} semantic role category(ies) missing`,
      detail: `Missing categories: ${missingCategories.join(', ')}\nDeclared roles: ${[...declaredRoleNames].join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'USS003',
    message: `All ${REQUIRED_CATEGORIES.length} semantic role categories covered (${declaredRoleNames.size} role(s) total)`,
  };
}
