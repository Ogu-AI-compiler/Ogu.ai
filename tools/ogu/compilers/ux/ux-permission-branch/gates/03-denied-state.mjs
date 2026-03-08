/**
 * Gate UPB003 — denied-state
 * Every restriction in every branch with type="hide" or type="disable" must declare
 * either `deniedMessage` (string) or `redirectTo` (string).
 * Escape hatch: restriction.silentDeny = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRES_DENIED_STATE = new Set(['hide', 'disable']);

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB003',
      message: 'permission-branch-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UPB003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.branches)) {
    return {
      pass: true,
      code: 'UPB003',
      message: 'No branches array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const branch of spec.branches) {
    if (!Array.isArray(branch.restrictions)) continue;

    for (const restriction of branch.restrictions) {
      if (!REQUIRES_DENIED_STATE.has(restriction.type)) continue;

      // Escape hatch: silentDeny
      if (restriction.silentDeny === true) continue;

      const hasDeniedMessage =
        typeof restriction.deniedMessage === 'string' &&
        restriction.deniedMessage.trim() !== '';
      const hasRedirectTo =
        typeof restriction.redirectTo === 'string' &&
        restriction.redirectTo.trim() !== '';

      if (!hasDeniedMessage && !hasRedirectTo) {
        const label =
          `branch(roleId="${branch.roleId ?? 'unknown'}", ` +
          `targetId="${restriction.targetId ?? 'unknown'}", type="${restriction.type}")`;
        violations.push(
          `${label} missing deniedMessage or redirectTo — ` +
          'hidden/disabled elements must communicate the denial to the user'
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UPB003',
      message: `${violations.length} restriction(s) missing denied state declaration`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UPB003',
    message: 'denied-state: all hide/disable restrictions declare deniedMessage or redirectTo',
  };
}
