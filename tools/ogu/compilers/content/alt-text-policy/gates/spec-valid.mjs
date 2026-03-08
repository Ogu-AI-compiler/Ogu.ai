import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ALT001 — spec-valid: spec file exists, is valid JSON, and has required structure */
export async function run({ dir }) {
  const specPath = join(dir, 'alt-text-policy.spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'ALT001',
      message: 'alt-text-policy.spec.json not found',
      detail: `Expected file at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'ALT001',
      message: 'alt-text-policy.spec.json is not valid JSON',
      detail: err.message,
    };
  }

  if (!Array.isArray(spec.contexts) || spec.contexts.length === 0) {
    return {
      pass: false,
      code: 'ALT001',
      message: 'spec.contexts must be a non-empty array of image usage contexts',
    };
  }

  const violations = [];
  for (const ctx of spec.contexts) {
    if (!ctx.name || typeof ctx.name !== 'string') {
      violations.push(`Context missing name: ${JSON.stringify(ctx).slice(0, 60)}`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'ALT001',
      message: `${violations.length} context(s) missing required name field`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'ALT001',
    message: `Spec valid — ${spec.contexts.length} image context(s)`,
  };
}
