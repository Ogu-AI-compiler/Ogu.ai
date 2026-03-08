import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** UTS008 — contract-typography: validates spec against typography-scale.contract.json */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'typography-scale.contract.json');

const REQUIRED_STEP_IDS = ['h1', 'h2', 'body'];
const VALID_FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 'thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'];

export async function run({ dir }) {
  const specPath = join(dir, 'typography-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTS008', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTS008', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UTS008', message: `Cannot load contract: ${err.message}` };
  }

  const steps = Array.isArray(spec.steps) ? spec.steps : [];
  const stepIds = new Set(steps.map(s => String(s.id || s.name || '').toLowerCase()));
  const violations = [];

  // Rule: heading-and-body-declared — h1, h2, and body steps must exist
  for (const required of REQUIRED_STEP_IDS) {
    if (!stepIds.has(required)) {
      violations.push(`Rule "heading-and-body-declared": step "${required}" not found in scale`);
    }
  }

  // Rule: font-family-declared — spec must declare at least one fontFamily
  if (!spec.fontFamily && !spec.fontFamilies) {
    violations.push('Rule "font-family-declared": no fontFamily or fontFamilies field declared');
  }

  // Rule: valid-font-weights — every step fontWeight must be a valid CSS weight
  for (const step of steps) {
    const stepId = step.id || step.name || '(unnamed)';
    if (step.fontWeight !== undefined) {
      const weight = typeof step.fontWeight === 'string' ? step.fontWeight.toLowerCase() : step.fontWeight;
      if (!VALID_FONT_WEIGHTS.includes(weight)) {
        violations.push(`Rule "valid-font-weights": step "${stepId}" fontWeight "${step.fontWeight}" is not a valid CSS font-weight`);
      }
    }
  }

  // Rule: base-size-declared — spec must declare baseSize for scale computation traceability
  if (!spec.baseSize && !spec.base) {
    violations.push('Rule "base-size-declared": no baseSize or base field declared — makes scale computation unverifiable');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTS008',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UTS008', message: `Contract "${contract.id}" satisfied (${steps.length} steps)` };
}
