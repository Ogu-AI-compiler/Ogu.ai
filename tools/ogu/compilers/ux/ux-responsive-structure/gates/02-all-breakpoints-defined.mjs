/**
 * Gate URS002 — all-breakpoints-defined
 * Spec must define breakpoints covering all three tiers:
 * - mobile: minWidth <= 480
 * - tablet: minWidth 481-1023
 * - desktop: minWidth >= 1024
 * Escape hatch: spec.mobileOnly = true or spec.desktopOnly = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'responsive-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URS002',
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
      code: 'URS002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (spec.mobileOnly === true || spec.desktopOnly === true) {
    const mode = spec.mobileOnly ? 'mobileOnly' : 'desktopOnly';
    return {
      pass: true,
      code: 'URS002',
      message: `all-breakpoints-defined: ${mode}:true — full tier coverage not required`,
      skipped: true,
    };
  }

  if (!Array.isArray(spec.breakpoints)) {
    return {
      pass: true,
      code: 'URS002',
      message: 'No breakpoints array — skipped',
      skipped: true,
    };
  }

  const hasMobile = spec.breakpoints.some(bp => typeof bp.minWidth === 'number' && bp.minWidth <= 480);
  const hasTablet = spec.breakpoints.some(bp => typeof bp.minWidth === 'number' && bp.minWidth >= 481 && bp.minWidth <= 1023);
  const hasDesktop = spec.breakpoints.some(bp => typeof bp.minWidth === 'number' && bp.minWidth >= 1024);

  const missing = [];
  if (!hasMobile) missing.push('mobile tier (minWidth <= 480)');
  if (!hasTablet) missing.push('tablet tier (minWidth 481-1023)');
  if (!hasDesktop) missing.push('desktop tier (minWidth >= 1024)');

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'URS002',
      message: `Missing breakpoint coverage for: ${missing.join(', ')}`,
      detail: `Declare breakpoints for all three tiers or set spec.mobileOnly:true or spec.desktopOnly:true.\nMissing: ${missing.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'URS002',
    message: 'all-breakpoints-defined: mobile, tablet, and desktop tiers all covered',
  };
}
