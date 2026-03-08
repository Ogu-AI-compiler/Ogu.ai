import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UMO004 — easing-valid: all easing values in spec.easings are valid
 * cubic-bezier() functions or named CSS easing keywords.
 */

const CSS_EASING_KEYWORDS = new Set([
  'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
  'step-start', 'step-end',
]);

// cubic-bezier(x1, y1, x2, y2) where x1, x2 ∈ [0, 1]
const CUBIC_BEZIER_PATTERN = /^cubic-bezier\(\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/;

// steps(N, start|end)
const STEPS_PATTERN = /^steps\(\s*\d+\s*(?:,\s*(?:start|end))?\s*\)$/;

function isValidEasing(value) {
  if (!value) return false;
  const str = String(value).trim().toLowerCase();

  if (CSS_EASING_KEYWORDS.has(str)) return true;
  if (STEPS_PATTERN.test(str)) return true;

  const cbMatch = CUBIC_BEZIER_PATTERN.exec(str);
  if (cbMatch) {
    const x1 = parseFloat(cbMatch[1]);
    const x2 = parseFloat(cbMatch[3]);
    // x1 and x2 must be in [0, 1] per CSS spec
    return x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1;
  }

  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'motion-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UMO004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UMO004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const easings = (spec.easings && typeof spec.easings === 'object') ? spec.easings : {};

  if (Object.keys(easings).length === 0) {
    return { pass: true, code: 'UMO004', message: 'No easings declared — gate skipped', skipped: true };
  }

  const violations = [];

  for (const [name, value] of Object.entries(easings)) {
    if (!isValidEasing(value)) {
      violations.push(`Easing "${name}": "${String(value).slice(0, 60)}" is not a valid CSS easing value`);
    }
  }

  // Also check that animation.easing fields reference declared easing names or are inline values
  const animations = Array.isArray(spec.animations) ? spec.animations : [];
  const knownEasingNames = new Set(Object.keys(easings));

  for (const anim of animations) {
    if (!anim.easing) continue;
    const easingRef = String(anim.easing);
    // If it's not a known named easing AND not a valid inline easing value
    if (!knownEasingNames.has(easingRef) && !isValidEasing(easingRef)) {
      violations.push(`Animation "${anim.id}" easing "${easingRef.slice(0, 40)}" is not a declared easing name or valid CSS value`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UMO004',
      message: `${violations.length} invalid easing value(s)`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UMO004', message: `All ${Object.keys(easings).length} easing(s) are valid CSS values` };
}
