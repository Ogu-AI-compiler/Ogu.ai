import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ALT002 — context-required-declared: every image context must explicitly declare altTextRequired */
export async function run({ dir }) {
  const specPath = join(dir, 'alt-text-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'ALT002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'ALT002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contexts) || spec.contexts.length === 0) {
    return { pass: true, code: 'ALT002', message: 'No contexts defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ctx of spec.contexts) {
    if (!Object.prototype.hasOwnProperty.call(ctx, 'altTextRequired')) {
      violations.push(`Context "${ctx.name}": altTextRequired not declared (must be true or false)`);
    } else if (typeof ctx.altTextRequired !== 'boolean') {
      violations.push(
        `Context "${ctx.name}": altTextRequired must be boolean, got ${typeof ctx.altTextRequired}`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'ALT002',
      message: `${violations.length} context(s) missing altTextRequired declaration`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'ALT002',
    message: `All ${spec.contexts.length} context(s) have altTextRequired declared`,
  };
}
