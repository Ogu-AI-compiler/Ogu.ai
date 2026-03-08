import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ALT007 — auto-generation-declared: autoGeneration rule must be "allowed" or "not-allowed" (not absent) */
const VALID_VALUES = ['allowed', 'not-allowed'];

export async function run({ dir }) {
  const specPath = join(dir, 'alt-text-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'ALT007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'ALT007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contexts) || spec.contexts.length === 0) {
    return { pass: true, code: 'ALT007', message: 'No contexts defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ctx of spec.contexts) {
    if (!Object.prototype.hasOwnProperty.call(ctx, 'autoGeneration')) {
      violations.push(`Context "${ctx.name}": autoGeneration not declared`);
      continue;
    }

    if (!VALID_VALUES.includes(ctx.autoGeneration)) {
      violations.push(
        `Context "${ctx.name}": autoGeneration="${ctx.autoGeneration}" is invalid. ` +
        `Must be "allowed" or "not-allowed"`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'ALT007',
      message: `${violations.length} context(s) with missing or invalid autoGeneration declaration`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'ALT007',
    message: `All ${spec.contexts.length} context(s) have valid autoGeneration declarations`,
  };
}
