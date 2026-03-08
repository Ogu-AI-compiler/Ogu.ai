/**
 * Gate UEV003 — flag-alignment
 * Every variant.featureFlag must be a non-empty string.
 * Variants without a feature flag cannot be activated programmatically.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV003',
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
      code: 'UEV003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.variants)) {
    return {
      pass: true,
      code: 'UEV003',
      message: 'No variants array — skipped',
      skipped: true,
    };
  }

  const violations = [];
  spec.variants.forEach((v, i) => {
    const id = v.id || `variants[${i}]`;
    if (typeof v.featureFlag !== 'string' || v.featureFlag.trim() === '') {
      violations.push(`Variant "${id}" has missing or empty featureFlag — cannot be activated programmatically`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UEV003',
      message: `${violations.length} variant(s) missing featureFlag`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UEV003',
    message: `flag-alignment: all ${spec.variants.length} variant(s) have non-empty featureFlag`,
  };
}
