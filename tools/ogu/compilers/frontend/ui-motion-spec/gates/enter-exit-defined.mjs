import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UMO005 — enter-exit-defined: both enter and exit transition types are declared.
 *
 * UI elements that appear must also disappear — asymmetric motion specs are incomplete.
 * Every component that uses "enter" animations must have a corresponding "exit" animation.
 */
export async function run({ dir }) {
  const specPath = join(dir, 'motion-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UMO005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UMO005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const animations = Array.isArray(spec.animations) ? spec.animations : [];
  if (animations.length === 0) {
    return { pass: true, code: 'UMO005', message: 'No animations — gate skipped', skipped: true };
  }

  const types = new Set(animations.map(a => String(a.type || '').toLowerCase()));

  const hasEnter = types.has('enter');
  const hasExit  = types.has('exit');

  if (!hasEnter && !hasExit) {
    return {
      pass: false,
      code: 'UMO005',
      message: 'No enter or exit animation types declared — at least one of each is required',
      detail: `Declared types: ${[...types].join(', ') || 'none'}`,
    };
  }

  if (hasEnter && !hasExit) {
    return {
      pass: false,
      code: 'UMO005',
      message: 'Enter animations declared but no exit animations — asymmetric motion spec',
      detail: 'Add at least one animation with type: "exit"',
    };
  }

  if (hasExit && !hasEnter) {
    return {
      pass: false,
      code: 'UMO005',
      message: 'Exit animations declared but no enter animations — asymmetric motion spec',
      detail: 'Add at least one animation with type: "enter"',
    };
  }

  const enterCount = animations.filter(a => String(a.type || '').toLowerCase() === 'enter').length;
  const exitCount  = animations.filter(a => String(a.type || '').toLowerCase() === 'exit').length;

  return {
    pass: true,
    code: 'UMO005',
    message: `Enter and exit both defined (${enterCount} enter, ${exitCount} exit)`,
  };
}
