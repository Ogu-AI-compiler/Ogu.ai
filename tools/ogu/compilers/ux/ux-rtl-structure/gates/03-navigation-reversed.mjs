/**
 * Gate URT003 — navigation-reversed
 * If spec has a navigation object, it must declare:
 * - rtlReverseDirection: true
 * - rtlBackIcon (string — the RTL version of the back arrow icon)
 * Escape hatch: spec.navigation.directionNeutral = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'rtl-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URT003',
      message: 'rtl-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URT003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.navigation !== 'object' || spec.navigation === null || Array.isArray(spec.navigation)) {
    return {
      pass: true,
      code: 'URT003',
      message: 'navigation-reversed: no navigation object — gate not applicable',
    };
  }

  const nav = spec.navigation;

  if (nav.directionNeutral === true) {
    return {
      pass: true,
      code: 'URT003',
      message: 'navigation-reversed: directionNeutral:true — RTL reversal not required',
      skipped: true,
    };
  }

  const violations = [];

  if (nav.rtlReverseDirection !== true) {
    violations.push('navigation.rtlReverseDirection must be true for RTL locales');
  }

  if (typeof nav.rtlBackIcon !== 'string' || nav.rtlBackIcon.trim() === '') {
    violations.push('navigation.rtlBackIcon (string) is missing — declare the RTL back arrow icon name');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URT003',
      message: `navigation is missing RTL direction declarations: ${violations.length} issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URT003',
    message: `navigation-reversed: rtlReverseDirection=true, rtlBackIcon="${nav.rtlBackIcon}"`,
  };
}
