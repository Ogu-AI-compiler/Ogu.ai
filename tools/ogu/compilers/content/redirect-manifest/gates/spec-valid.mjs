import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RDR001 — spec-valid: spec file exists, is valid JSON, and has required structure */
export async function run({ dir }) {
  const specPath = join(dir, 'redirect-manifest.spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'RDR001',
      message: 'redirect-manifest.spec.json not found',
      detail: `Expected file at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'RDR001',
      message: 'redirect-manifest.spec.json is not valid JSON',
      detail: err.message,
    };
  }

  if (!Array.isArray(spec.redirects)) {
    return {
      pass: false,
      code: 'RDR001',
      message: 'spec.redirects must be an array',
    };
  }

  if (spec.redirects.length === 0) {
    return {
      pass: true,
      code: 'RDR001',
      message: 'Empty redirects array — no redirects to validate',
      skipped: true,
    };
  }

  const violations = [];
  for (const r of spec.redirects) {
    if (!r.from) violations.push(`Redirect missing "from": ${JSON.stringify(r).slice(0, 60)}`);
    if (!r.to)   violations.push(`Redirect missing "to": ${JSON.stringify(r).slice(0, 60)}`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RDR001',
      message: `${violations.length} redirect(s) missing required fields`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RDR001',
    message: `Spec valid — ${spec.redirects.length} redirect(s)`,
  };
}
