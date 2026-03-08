/**
 * Gate UXS007 — partial-state
 * Screens with paginated or optional data (partial: true, paginated: true,
 * or any dependency with optional: true) must declare a "partial" state
 * that describes the UI when some but not all data is available.
 * Escape hatch: screen.partialStateNotApplicable = true.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function needsPartialState(screen) {
  if (screen.paginated === true) return true;
  if (screen.partial === true) return true;
  if (!Array.isArray(screen.dataDependencies)) return false;
  return screen.dataDependencies.some(dep => {
    if (typeof dep === 'object' && dep !== null) {
      return dep.optional === true || dep.paginated === true;
    }
    return false;
  });
}

function hasPartialState(screen) {
  if (!Array.isArray(screen.states)) return false;
  return screen.states.some(s => {
    const type = typeof s === 'string' ? s : s.type;
    return type === 'partial';
  });
}

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXS007', message: 'state-matrix-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXS007', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
    return { pass: true, code: 'UXS007', message: 'No screens to check — skipped', skipped: true };
  }

  const violations = [];

  for (const screen of spec.screens) {
    if (!needsPartialState(screen)) continue;
    if (screen.partialStateNotApplicable === true) continue;
    if (!hasPartialState(screen)) {
      violations.push(
        `Screen "${screen.id}" has paginated/optional data but no "partial" state declared`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS007',
      message: `${violations.length} screen(s) with paginated/optional data missing partial state`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS007',
    message: 'partial-state: all paginated/optional-data screens declare partial state',
  };
}
