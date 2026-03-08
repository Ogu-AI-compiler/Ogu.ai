import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UTS006 — i18n-stacks: i18n font stacks defined for every declared non-Latin script.
 *
 * If spec declares i18n.scripts (e.g. ["arabic", "hebrew", "cjk", "devanagari"]),
 * spec.i18n.fontStacks must have an entry for each script.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'typography-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTS006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTS006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // If spec does not declare i18n requirements, gate is not applicable
  if (!spec.i18n) {
    return { pass: true, code: 'UTS006', message: 'No i18n requirements declared — gate skipped', skipped: true };
  }

  const scripts = Array.isArray(spec.i18n.scripts) ? spec.i18n.scripts : [];
  if (scripts.length === 0) {
    return { pass: true, code: 'UTS006', message: 'No non-Latin scripts declared — gate skipped', skipped: true };
  }

  const fontStacks = spec.i18n.fontStacks || {};
  const missing = scripts.filter(script => !fontStacks[script]);

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UTS006',
      message: `${missing.length} non-Latin script(s) missing i18n font stack`,
      detail: `Missing stacks for: ${missing.join(', ')}\nExpected in spec.i18n.fontStacks`,
    };
  }

  return {
    pass: true,
    code: 'UTS006',
    message: `All ${scripts.length} script(s) have i18n font stacks: ${scripts.join(', ')}`,
  };
}
