/**
 * Gate UPB006 — valid-flow-references
 * Every `redirectTo` in restrictions must be a non-empty string.
 * Format validation: must start with "/" or be a named flow id (alphanumeric, hyphens, underscores).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Valid: starts with "/" (URL/route) OR is a named flow id (no spaces, no special chars)
function isValidRedirectTo(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (value.startsWith('/')) return true;
  // Named flow id: only word chars and hyphens
  return /^[\w-]+$/.test(value);
}

export async function run({ dir }) {
  const specPath = join(dir, 'permission-branch-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UPB006',
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
      code: 'UPB006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.branches)) {
    return {
      pass: true,
      code: 'UPB006',
      message: 'No branches array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const branch of spec.branches) {
    if (!Array.isArray(branch.restrictions)) continue;

    for (const restriction of branch.restrictions) {
      // Only check restrictions that declare redirectTo
      if (!Object.prototype.hasOwnProperty.call(restriction, 'redirectTo')) continue;

      const label =
        `branch(roleId="${branch.roleId ?? 'unknown'}", ` +
        `targetId="${restriction.targetId ?? 'unknown'}")`;

      if (restriction.redirectTo === null || restriction.redirectTo === undefined) {
        violations.push(
          `${label} redirectTo is null/undefined — use a non-empty string or remove the field`
        );
        continue;
      }

      if (!isValidRedirectTo(restriction.redirectTo)) {
        violations.push(
          `${label} redirectTo="${restriction.redirectTo}" is invalid — ` +
          'must start with "/" (route) or be a named flow id (alphanumeric with hyphens/underscores)'
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UPB006',
      message: `${violations.length} invalid redirectTo reference(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UPB006',
    message: 'valid-flow-references: all redirectTo values are valid routes or flow ids',
  };
}
