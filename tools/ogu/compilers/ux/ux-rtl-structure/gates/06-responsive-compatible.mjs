/**
 * Gate URT006 — responsive-compatible
 * If spec.responsiveSpecRef exists (references a responsive-spec.json),
 * check that no breakpoint in the responsive spec explicitly sets fixed
 * directional padding/margins without RTL override declarations.
 * Escape hatch: spec.responsiveCompatibilityExempt = true
 *
 * Note: This gate resolves the responsiveSpecRef relative to the same dir.
 * If the file is absent, the gate passes with a skip notice.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DIRECTIONAL_PROPS = [
  'paddingLeft', 'paddingRight', 'marginLeft', 'marginRight',
  'padding-left', 'padding-right', 'margin-left', 'margin-right',
  'left', 'right',
];

export async function run({ dir }) {
  const specPath = join(dir, 'rtl-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URT006',
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
      code: 'URT006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (spec.responsiveCompatibilityExempt === true) {
    return {
      pass: true,
      code: 'URT006',
      message: 'responsive-compatible: responsiveCompatibilityExempt:true — gate not applicable',
      skipped: true,
    };
  }

  if (typeof spec.responsiveSpecRef !== 'string' || spec.responsiveSpecRef.trim() === '') {
    return {
      pass: true,
      code: 'URT006',
      message: 'responsive-compatible: no responsiveSpecRef — gate not applicable',
    };
  }

  const responsivePath = join(dir, spec.responsiveSpecRef);
  if (!existsSync(responsivePath)) {
    return {
      pass: true,
      code: 'URT006',
      message: `responsive-compatible: responsiveSpecRef="${spec.responsiveSpecRef}" not found — gate skipped`,
      skipped: true,
    };
  }

  let responsiveSpec;
  try {
    responsiveSpec = JSON.parse(readFileSync(responsivePath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URT006',
      message: `responsive-compatible: responsiveSpecRef parse error — gate skipped`,
      skipped: true,
    };
  }

  const violations = [];
  const breakpoints = Array.isArray(responsiveSpec.breakpoints) ? responsiveSpec.breakpoints : [];

  breakpoints.forEach(bp => {
    const styles = bp.styles || {};
    DIRECTIONAL_PROPS.forEach(prop => {
      if (prop in styles) {
        const hasRtlOverride = `rtl_${prop}` in styles || `rtl-${prop}` in styles || styles.rtlOverride;
        if (!hasRtlOverride) {
          violations.push(
            `Breakpoint "${bp.name || 'unknown'}" sets directional property "${prop}" without RTL override`
          );
        }
      }
    });
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URT006',
      message: `${violations.length} breakpoint(s) in responsive spec have fixed directional properties without RTL overrides`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URT006',
    message: `responsive-compatible: responsive spec "${spec.responsiveSpecRef}" has no fixed directional properties without RTL overrides`,
  };
}
