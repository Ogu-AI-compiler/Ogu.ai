/**
 * Gate UEV002 — control-group
 * Exactly one variant must have isControl: true.
 * A control group is mandatory for valid A/B experiments.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV002',
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
      code: 'UEV002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.variants)) {
    return {
      pass: true,
      code: 'UEV002',
      message: 'No variants array — skipped',
      skipped: true,
    };
  }

  const controlVariants = spec.variants.filter(v => v.isControl === true);

  if (controlVariants.length === 0) {
    return {
      pass: false,
      code: 'UEV002',
      message: 'No variant has isControl:true — exactly one control group is required for a valid A/B experiment',
    };
  }

  if (controlVariants.length > 1) {
    const ids = controlVariants.map(v => v.id || 'unknown').join(', ');
    return {
      pass: false,
      code: 'UEV002',
      message: `${controlVariants.length} variants have isControl:true (${ids}) — exactly one control group is allowed`,
    };
  }

  return {
    pass: true,
    code: 'UEV002',
    message: `control-group: control variant="${controlVariants[0].id}"`,
  };
}
