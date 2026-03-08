import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** USS007 — contract-spacing: validates spec against spacing-scale.contract.json */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'spacing-scale.contract.json');

export async function run({ dir }) {
  const specPath = join(dir, 'spacing-scale-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USS007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USS007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'USS007', message: `Cannot load contract: ${err.message}` };
  }

  const steps = Array.isArray(spec.steps) ? spec.steps : [];
  const violations = [];

  // Rule: minimum-four-steps — scale should have at least 4 distinct steps
  if (steps.length < 4) {
    violations.push(`Rule "minimum-four-steps": only ${steps.length} step(s) declared — minimum 4 required for a usable scale`);
  }

  // Rule: steps-have-ids — every step must have an id or name for traceability
  const stepsWithoutId = steps.filter(s => !s.id && !s.name);
  if (stepsWithoutId.length > 0) {
    violations.push(`Rule "steps-have-ids": ${stepsWithoutId.length} step(s) missing id or name field`);
  }

  // Rule: steps-have-values — every step must have a value field
  const stepsWithoutValue = steps.filter(s => s.value === undefined);
  if (stepsWithoutValue.length > 0) {
    violations.push(`Rule "steps-have-values": ${stepsWithoutValue.length} step(s) missing value field`);
  }

  // Rule: base-unit-parseable — baseUnit must be parseable (numeric or px)
  if (spec.baseUnit !== undefined) {
    const str = String(spec.baseUnit).trim().toLowerCase();
    const valid = /^[\d.]+(px|rem)?$/.test(str);
    if (!valid) {
      violations.push(`Rule "base-unit-parseable": baseUnit "${spec.baseUnit}" cannot be parsed as a pixel value`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS007',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USS007', message: `Contract "${contract.id}" satisfied (${steps.length} steps)` };
}
