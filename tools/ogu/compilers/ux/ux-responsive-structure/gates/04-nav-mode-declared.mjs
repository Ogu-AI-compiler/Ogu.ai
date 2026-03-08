/**
 * Gate URS004 — nav-mode-declared
 * If spec has a navigation object, each breakpoint must declare navMode:
 * "topbar" | "sidebar" | "hamburger" | "tabs" | "bottom-bar"
 * Missing navMode means undefined navigation rendering.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_NAV_MODES = new Set(['topbar', 'sidebar', 'hamburger', 'tabs', 'bottom-bar']);

export async function run({ dir }) {
  const specPath = join(dir, 'responsive-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URS004',
      message: 'responsive-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URS004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.navigation !== 'object' || spec.navigation === null || Array.isArray(spec.navigation)) {
    return {
      pass: true,
      code: 'URS004',
      message: 'nav-mode-declared: no navigation object — gate not applicable',
    };
  }

  if (!Array.isArray(spec.breakpoints) || spec.breakpoints.length === 0) {
    return {
      pass: true,
      code: 'URS004',
      message: 'nav-mode-declared: no breakpoints to check — gate not applicable',
    };
  }

  const navBreakpoints = spec.navigation.breakpoints || {};
  const violations = [];

  spec.breakpoints.forEach(bp => {
    const name = bp.name;
    if (!name) return;
    const navEntry = navBreakpoints[name];
    if (typeof navEntry !== 'object' || navEntry === null) {
      violations.push(`Navigation has no entry for breakpoint "${name}" — navMode required`);
      return;
    }
    if (typeof navEntry.navMode !== 'string') {
      violations.push(`Navigation breakpoint "${name}" missing navMode`);
    } else if (!VALID_NAV_MODES.has(navEntry.navMode)) {
      violations.push(
        `Navigation breakpoint "${name}" navMode="${navEntry.navMode}" is invalid — must be one of: ${[...VALID_NAV_MODES].join(', ')}`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URS004',
      message: `${violations.length} breakpoint(s) missing or invalid navMode`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URS004',
    message: `nav-mode-declared: all ${spec.breakpoints.length} breakpoint(s) have valid navMode`,
  };
}
