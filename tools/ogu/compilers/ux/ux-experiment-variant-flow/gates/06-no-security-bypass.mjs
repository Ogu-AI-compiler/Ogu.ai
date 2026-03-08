/**
 * Gate UEV006 — no-security-bypass
 * No variant may declare:
 * - bypassAuth: true
 * - bypassValidation: true
 * - skipGuards: true
 * Experiments cannot bypass security/validation constraints regardless of hypothesis.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FORBIDDEN_FLAGS = ['bypassAuth', 'bypassValidation', 'skipGuards'];

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV006',
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
      code: 'UEV006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.variants)) {
    return {
      pass: true,
      code: 'UEV006',
      message: 'No variants array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  spec.variants.forEach((v, i) => {
    const id = v.id || `variants[${i}]`;
    FORBIDDEN_FLAGS.forEach(flag => {
      if (v[flag] === true) {
        violations.push(
          `Variant "${id}" declares ${flag}:true — experiments cannot bypass security or validation constraints`
        );
      }
    });
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UEV006',
      message: `${violations.length} variant(s) declare forbidden security bypass flag(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UEV006',
    message: `no-security-bypass: all ${spec.variants.length} variant(s) pass security constraint check`,
  };
}
