/**
 * Gate UXS001 — spec-valid
 * state-matrix-spec.json must exist with a screens array.
 * Each screen must have: id (string), dataDependencies (array).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'UXS001',
      message: 'state-matrix-spec.json not found',
      detail: `Expected: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UXS001',
      message: `state-matrix-spec.json parse error: ${err.message}`,
    };
  }

  if (!Array.isArray(spec.screens)) {
    return {
      pass: false,
      code: 'UXS001',
      message: 'state-matrix-spec.json missing required field: screens (must be an array)',
    };
  }

  if (spec.screens.length === 0) {
    return {
      pass: false,
      code: 'UXS001',
      message: 'state-matrix-spec.json screens array is empty — at least one screen required',
    };
  }

  const violations = [];
  spec.screens.forEach((screen, i) => {
    if (typeof screen.id !== 'string' || screen.id.trim() === '') {
      violations.push(`screens[${i}] missing or invalid field: id`);
    }
    if (!Array.isArray(screen.dataDependencies)) {
      violations.push(`screens[${i}] (id="${screen.id}") missing field: dataDependencies (must be array)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS001',
      message: `${violations.length} screen(s) with missing required fields`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS001',
    message: `spec-valid: ${spec.screens.length} screen(s) parsed successfully`,
  };
}
