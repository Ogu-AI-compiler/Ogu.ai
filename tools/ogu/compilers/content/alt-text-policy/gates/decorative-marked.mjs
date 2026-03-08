import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ALT003 — decorative-marked: decorative image contexts must declare emptyAltPermitted:true AND ariaHidden:true */
export async function run({ dir }) {
  const specPath = join(dir, 'alt-text-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'ALT003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'ALT003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contexts) || spec.contexts.length === 0) {
    return { pass: true, code: 'ALT003', message: 'No contexts defined — gate skipped', skipped: true };
  }

  // Find decorative contexts: altTextRequired: false indicates decorative
  const decorativeContexts = spec.contexts.filter(c => c.altTextRequired === false);

  if (decorativeContexts.length === 0) {
    return {
      pass: true,
      code: 'ALT003',
      message: 'No decorative contexts (altTextRequired:false) — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const ctx of decorativeContexts) {
    if (ctx.emptyAltPermitted !== true) {
      violations.push(`Context "${ctx.name}": decorative context missing emptyAltPermitted:true`);
    }
    if (ctx.ariaHidden !== true) {
      violations.push(`Context "${ctx.name}": decorative context missing ariaHidden:true`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'ALT003',
      message: `${violations.length} decorative context(s) missing required a11y declarations`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'ALT003',
    message: `All ${decorativeContexts.length} decorative context(s) correctly marked`,
  };
}
