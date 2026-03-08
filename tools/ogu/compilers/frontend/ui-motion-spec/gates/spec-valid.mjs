import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UMO001 — spec-valid: motion-spec.json exists with required fields.
 *
 * Expected shape:
 * {
 *   "easings": { "standard": "cubic-bezier(...)", "decelerate": "...", "accelerate": "..." },
 *   "animations": [
 *     { "id": "fade-in", "type": "enter", "duration": "150ms", "easing": "standard", "reducedMotion": "instant" }
 *   ]
 * }
 */
export async function run({ dir }) {
  const specPath = join(dir, 'motion-spec.json');

  if (!existsSync(specPath)) {
    return { pass: false, code: 'UMO001', message: 'motion-spec.json not found', detail: `Expected at: ${specPath}` };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UMO001', message: 'motion-spec.json is not valid JSON', detail: err.message };
  }

  if (!spec.animations || !Array.isArray(spec.animations) || spec.animations.length === 0) {
    return { pass: false, code: 'UMO001', message: 'motion-spec.json missing required field: animations (non-empty array)' };
  }

  if (!spec.easings || typeof spec.easings !== 'object') {
    return { pass: false, code: 'UMO001', message: 'motion-spec.json missing required field: easings (object)' };
  }

  // Each animation must have id, type, duration, easing
  const missingFields = [];
  for (const [i, anim] of spec.animations.entries()) {
    const animId = anim.id || `animations[${i}]`;
    if (!anim.id)       missingFields.push(`${animId} missing: id`);
    if (!anim.type)     missingFields.push(`${animId} missing: type`);
    if (!anim.duration) missingFields.push(`${animId} missing: duration`);
    if (!anim.easing)   missingFields.push(`${animId} missing: easing`);
  }

  if (missingFields.length > 0) {
    return {
      pass: false,
      code: 'UMO001',
      message: `${missingFields.length} animation(s) have missing required fields`,
      detail: missingFields.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UMO001', message: `Spec valid — ${spec.animations.length} animation(s), ${Object.keys(spec.easings).length} easing(s)` };
}
