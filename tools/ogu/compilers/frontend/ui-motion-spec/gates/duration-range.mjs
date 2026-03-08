import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UMO002 — duration-range: all durations are between 100ms and 500ms.
 *
 * Rationale:
 * - < 100ms: too fast to perceive, wastes the animation budget
 * - > 500ms: too slow, degrades perceived performance
 * - Exception: spec.allowedOutOfRange: ["anim-id"] for intentional outliers (e.g. page transitions at 600ms)
 */

function parseDurationMs(value) {
  if (!value) return null;
  const str = String(value).trim().toLowerCase();

  const msMatch = /^([\d.]+)ms$/.exec(str);
  if (msMatch) return parseFloat(msMatch[1]);

  const sMatch = /^([\d.]+)s$/.exec(str);
  if (sMatch) return parseFloat(sMatch[1]) * 1000;

  const numMatch = /^[\d.]+$/.exec(str);
  if (numMatch) return parseFloat(str); // assume ms

  return null;
}

const MIN_MS = 100;
const MAX_MS = 500;

export async function run({ dir }) {
  const specPath = join(dir, 'motion-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UMO002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UMO002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const animations = Array.isArray(spec.animations) ? spec.animations : [];
  if (animations.length === 0) {
    return { pass: true, code: 'UMO002', message: 'No animations — gate skipped', skipped: true };
  }

  // Escape hatch: allowedOutOfRange is a list of animation IDs exempted from this gate
  const allowedOutOfRange = new Set(Array.isArray(spec.allowedOutOfRange) ? spec.allowedOutOfRange : []);

  const violations = [];

  for (const anim of animations) {
    if (allowedOutOfRange.has(anim.id)) continue;

    const ms = parseDurationMs(anim.duration);
    if (ms === null) continue; // Token reference — skip

    if (ms < MIN_MS || ms > MAX_MS) {
      violations.push(`"${anim.id}": duration ${anim.duration} = ${ms}ms — outside ${MIN_MS}–${MAX_MS}ms feedback range`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UMO002',
      message: `${violations.length} animation(s) have durations outside ${MIN_MS}–${MAX_MS}ms range`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UMO002', message: `All animation durations within ${MIN_MS}–${MAX_MS}ms` };
}
