import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UMO003 — reduced-motion-required: every animation has a reducedMotion override.
 *
 * Valid reducedMotion values:
 * - "instant"       — snap to end state immediately
 * - "opacity-only"  — fade only, no movement
 * - "none"          — no animation at all
 * - any string      — custom description of the fallback
 *
 * This gate fails if reducedMotion is absent or null/undefined.
 */
export async function run({ dir }) {
  const specPath = join(dir, 'motion-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UMO003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UMO003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const animations = Array.isArray(spec.animations) ? spec.animations : [];
  if (animations.length === 0) {
    return { pass: true, code: 'UMO003', message: 'No animations — gate skipped', skipped: true };
  }

  const violations = [];

  for (const anim of animations) {
    const animId = anim.id || '(unnamed)';
    if (anim.reducedMotion === undefined || anim.reducedMotion === null || anim.reducedMotion === '') {
      violations.push(`"${animId}": missing reducedMotion override (use "instant", "opacity-only", or "none")`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UMO003',
      message: `${violations.length} animation(s) missing reducedMotion override`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UMO003', message: `All ${animations.length} animation(s) have reducedMotion overrides` };
}
