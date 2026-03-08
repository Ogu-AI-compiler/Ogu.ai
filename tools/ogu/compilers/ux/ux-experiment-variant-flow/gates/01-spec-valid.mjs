/**
 * Gate UEV001 — spec-valid
 * experiment-variant-spec.json must exist with:
 * - experiment_id (string)
 * - hypothesis (string)
 * - variants (array) of at least 2 — each with id, name, flowRef(string), featureFlag(string)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV001',
      message: 'experiment-variant-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UEV001',
      message: `experiment-variant-spec.json parse error: ${err.message}`,
    };
  }

  const violations = [];

  if (typeof spec.experiment_id !== 'string' || spec.experiment_id.trim() === '') {
    violations.push('experiment_id (string) is missing or empty');
  }
  if (typeof spec.hypothesis !== 'string' || spec.hypothesis.trim() === '') {
    violations.push('hypothesis (string) is missing or empty');
  }
  if (!Array.isArray(spec.variants)) {
    violations.push('variants (array) is missing');
  } else if (spec.variants.length < 2) {
    violations.push(`variants array has ${spec.variants.length} entry/entries — at least 2 variants required for a valid experiment`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UEV001',
      message: `experiment-variant-spec.json missing required fields: ${violations.join('; ')}`,
    };
  }

  const variantViolations = [];
  spec.variants.forEach((v, i) => {
    if (typeof v.id !== 'string' || v.id.trim() === '') {
      variantViolations.push(`variants[${i}] missing id (string)`);
    }
    if (typeof v.name !== 'string' || v.name.trim() === '') {
      variantViolations.push(`variants[${i}] missing name (string)`);
    }
    if (typeof v.flowRef !== 'string' || v.flowRef.trim() === '') {
      variantViolations.push(`variants[${i}] missing flowRef (string)`);
    }
    if (typeof v.featureFlag !== 'string' || v.featureFlag.trim() === '') {
      variantViolations.push(`variants[${i}] missing featureFlag (string)`);
    }
  });

  if (variantViolations.length > 0) {
    return {
      pass: false,
      code: 'UEV001',
      message: `${variantViolations.length} variant(s) missing required fields`,
      detail: variantViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UEV001',
    message: `spec-valid: experiment_id="${spec.experiment_id}", ${spec.variants.length} variant(s)`,
  };
}
