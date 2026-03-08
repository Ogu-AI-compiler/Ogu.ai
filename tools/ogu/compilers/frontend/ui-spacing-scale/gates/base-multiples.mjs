import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** USS002 — base-multiples: every spacing step value is a multiple of the declared base unit */

function parsePx(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim().toLowerCase();

  const pxMatch = /^([\d.]+)px$/.exec(str);
  if (pxMatch) return parseFloat(pxMatch[1]);

  const remMatch = /^([\d.]+)rem$/.exec(str);
  if (remMatch) return parseFloat(remMatch[1]) * 16;

  const numMatch = /^[\d.]+$/.exec(str);
  if (numMatch) return parseFloat(str);

  return null; // Token reference or unknown
}

export async function run({ dir }) {
  const specPath = join(dir, 'spacing-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USS002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USS002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const baseUnitPx = parsePx(spec.baseUnit);
  if (!baseUnitPx || baseUnitPx <= 0) {
    return { pass: true, code: 'USS002', message: 'Cannot parse baseUnit — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { pass: true, code: 'USS002', message: 'No steps — gate skipped', skipped: true };
  }

  const violations = [];
  let checked = 0;

  for (const step of spec.steps) {
    const stepId = step.id || step.name || '(unnamed)';
    const valuePx = parsePx(step.value);

    if (valuePx === null) {
      // Token reference — skip
      continue;
    }

    checked++;
    // Allow a small floating point tolerance (0.01px)
    const remainder = valuePx % baseUnitPx;
    const isMultiple = remainder < 0.01 || (baseUnitPx - remainder) < 0.01;

    if (!isMultiple) {
      violations.push(`Step "${stepId}": ${step.value} = ${valuePx}px is not a multiple of ${baseUnitPx}px base unit`);
    }
  }

  if (checked === 0) {
    return { pass: true, code: 'USS002', message: 'All step values are token references — multiple check skipped', skipped: true };
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS002',
      message: `${violations.length} step(s) are not multiples of base unit (${spec.baseUnit})`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USS002', message: `All ${checked} step(s) are multiples of ${spec.baseUnit} base unit` };
}
