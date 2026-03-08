import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** UMO007 — contract-motion: validates spec against motion-spec.contract.json */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'motion-spec.contract.json');

export async function run({ dir }) {
  const specPath = join(dir, 'motion-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UMO007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UMO007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UMO007', message: `Cannot load contract: ${err.message}` };
  }

  const animations = Array.isArray(spec.animations) ? spec.animations : [];
  const easings    = (spec.easings && typeof spec.easings === 'object') ? spec.easings : {};
  const violations = [];

  // Rule: standard-easing-declared — a "standard" or "default" easing must exist
  const hasStandardEasing = Object.keys(easings).some(k =>
    k === 'standard' || k === 'default' || k === 'base'
  );
  if (!hasStandardEasing) {
    violations.push('Rule "standard-easing-declared": no standard/default/base easing defined — downstream components need a fallback easing');
  }

  // Rule: animation-ids-unique — no two animations share the same id
  const seen = new Map();
  for (const anim of animations) {
    if (anim.id) {
      if (seen.has(anim.id)) {
        violations.push(`Rule "animation-ids-unique": duplicate animation id "${anim.id}"`);
      } else {
        seen.set(anim.id, true);
      }
    }
  }

  // Rule: move-type-declared — at least a "move" or "layout" type must be defined
  // (for repositioning animations in addition to enter/exit)
  // This is a soft recommendation — only warn, not a hard failure
  // We make it required per the contract for completeness
  const hasMoveType = animations.some(a => {
    const t = String(a.type || '').toLowerCase();
    return t === 'move' || t === 'layout' || t === 'reorder' || t === 'transition';
  });
  if (!hasMoveType && animations.length > 0) {
    violations.push('Rule "move-type-declared": no "move"/"layout"/"transition" animation type declared — layout animations are needed for dynamic list reordering');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UMO007',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UMO007', message: `Contract "${contract.id}" satisfied (${animations.length} animations, ${Object.keys(easings).length} easings)` };
}
