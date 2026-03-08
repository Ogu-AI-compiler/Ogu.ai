/**
 * Gate URS001 — spec-valid
 * responsive-spec.json must exist with:
 * - breakpoints (array) — each with name(string), minWidth(number), layout(string)
 * - Must include at least "mobile" and "desktop" named breakpoints
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'responsive-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URS001',
      message: 'responsive-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'URS001',
      message: `responsive-spec.json parse error: ${err.message}`,
    };
  }

  if (!Array.isArray(spec.breakpoints)) {
    return {
      pass: false,
      code: 'URS001',
      message: 'breakpoints (array) is missing',
    };
  }

  if (spec.breakpoints.length === 0) {
    return {
      pass: false,
      code: 'URS001',
      message: 'breakpoints array is empty — at least mobile and desktop breakpoints are required',
    };
  }

  const violations = [];
  spec.breakpoints.forEach((bp, i) => {
    if (typeof bp.name !== 'string' || bp.name.trim() === '') {
      violations.push(`breakpoints[${i}] missing name (string)`);
    }
    if (typeof bp.minWidth !== 'number') {
      violations.push(`breakpoints[${i}] missing minWidth (number)`);
    }
    if (typeof bp.layout !== 'string' || bp.layout.trim() === '') {
      violations.push(`breakpoints[${i}] missing layout (string)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URS001',
      message: `${violations.length} breakpoint(s) missing required fields`,
      detail: violations.join('\n'),
    };
  }

  const names = spec.breakpoints.map(bp => bp.name);
  const missingNames = [];
  if (!names.includes('mobile')) missingNames.push('mobile');
  if (!names.includes('desktop')) missingNames.push('desktop');

  if (missingNames.length > 0) {
    return {
      pass: false,
      code: 'URS001',
      message: `breakpoints array must include named breakpoints: ${missingNames.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'URS001',
    message: `spec-valid: ${spec.breakpoints.length} breakpoint(s) including mobile and desktop`,
  };
}
