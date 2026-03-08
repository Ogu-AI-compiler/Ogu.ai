import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ALT004 — max-length-defined: max alt text character length must be defined per context (typically ≤ 125) */
const RECOMMENDED_MAX = 125;

export async function run({ dir }) {
  const specPath = join(dir, 'alt-text-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'ALT004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'ALT004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contexts) || spec.contexts.length === 0) {
    return { pass: true, code: 'ALT004', message: 'No contexts defined — gate skipped', skipped: true };
  }

  // Decorative contexts (altTextRequired:false) are exempt — they use empty alt=""
  const nonDecorativeContexts = spec.contexts.filter(c => c.altTextRequired !== false);

  if (nonDecorativeContexts.length === 0) {
    return {
      pass: true,
      code: 'ALT004',
      message: 'All contexts are decorative — max length gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const ctx of nonDecorativeContexts) {
    if (ctx.maxLength === undefined) {
      violations.push(`Context "${ctx.name}": maxLength not declared`);
      continue;
    }

    if (typeof ctx.maxLength !== 'number') {
      violations.push(`Context "${ctx.name}": maxLength must be a number, got ${typeof ctx.maxLength}`);
      continue;
    }

    if (ctx.maxLength > RECOMMENDED_MAX) {
      // Warn but don't fail — longer is allowed if intentional
      // Per guide: escape hatch pattern
      if (!ctx.longAltOk) {
        violations.push(
          `Context "${ctx.name}": maxLength=${ctx.maxLength} exceeds recommended ${RECOMMENDED_MAX} chars ` +
          `(set longAltOk:true to allow)`
        );
      }
    }

    if (ctx.maxLength <= 0) {
      violations.push(`Context "${ctx.name}": maxLength must be > 0`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'ALT004',
      message: `${violations.length} context(s) with invalid maxLength`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'ALT004',
    message: `All ${nonDecorativeContexts.length} non-decorative context(s) have valid maxLength`,
  };
}
