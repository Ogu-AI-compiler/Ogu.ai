/**
 * Gate UEV008 — contract-experiment-variant
 * Final contract check:
 * - version declared
 * - unique variant ids
 * - experiment_id non-empty
 * - hypothesis non-empty
 * - exactly one control variant
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV008',
      message: 'experiment-variant-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UEV008',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const violations = [];

  if (!spec.version) {
    violations.push('Contract: experiment-variant-spec.json missing field "version"');
  }

  if (typeof spec.experiment_id !== 'string' || spec.experiment_id.trim() === '') {
    violations.push('Contract: experiment_id is missing or empty');
  }

  if (typeof spec.hypothesis !== 'string' || spec.hypothesis.trim() === '') {
    violations.push('Contract: hypothesis is missing or empty');
  }

  if (Array.isArray(spec.variants)) {
    const seenIds = new Map();
    spec.variants.forEach((v, i) => {
      if (typeof v.id !== 'string') return;
      if (seenIds.has(v.id)) {
        violations.push(`Contract: Duplicate variant id "${v.id}"`);
      } else {
        seenIds.set(v.id, true);
      }
    });

    const controlCount = spec.variants.filter(v => v.isControl === true).length;
    if (controlCount !== 1) {
      violations.push(
        `Contract: Exactly one variant must have isControl:true (found ${controlCount})`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UEV008',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UEV008',
    message: 'contract-experiment-variant: all contract rules satisfied',
  };
}
