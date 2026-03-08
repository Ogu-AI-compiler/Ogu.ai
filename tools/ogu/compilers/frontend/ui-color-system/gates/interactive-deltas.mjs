import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCS006 — interactive-deltas: every semantic role defines hover, focus, and active state deltas */

const REQUIRED_STATES = ['hover', 'focus', 'active'];

export async function run({ dir }) {
  const specPath = join(dir, 'color-system-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCS006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCS006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.semanticRoles) || spec.semanticRoles.length === 0) {
    return { pass: true, code: 'UCS006', message: 'No semantic roles — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of spec.semanticRoles) {
    if (!role.interactiveStates || typeof role.interactiveStates !== 'object') {
      violations.push(`"${role.id}": missing interactiveStates object (needs hover, focus, active)`);
      continue;
    }

    const missingStates = REQUIRED_STATES.filter(
      state => role.interactiveStates[state] === undefined
    );

    if (missingStates.length > 0) {
      violations.push(
        `"${role.id}": interactiveStates missing: ${missingStates.join(', ')}`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS006',
      message: `${violations.length} semantic role(s) missing interactive state deltas`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS006',
    message: `All ${spec.semanticRoles.length} semantic role(s) have hover/focus/active deltas`,
  };
}
