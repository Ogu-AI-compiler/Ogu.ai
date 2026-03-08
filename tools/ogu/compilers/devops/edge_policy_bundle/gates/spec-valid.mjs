/**
 * Gate: spec-valid (EP001)
 * Validates that edge-policy-spec.json exists, is valid JSON, and declares
 * a name and a non-empty rules array. Missing fields cause downstream gates
 * (rate limits, CORS, WAF, geo restrictions) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'edge-policy-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'EP001',
      message: 'edge-policy-spec.json not found',
      detail: { searched: specPath, hint: 'Create edge-policy-spec.json with name and rules fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'EP001', message: `edge-policy-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = ['name', 'rules'].filter(f => !spec[f]);
  if (missing.length) {
    return {
      pass: false, code: 'EP001',
      message: `edge-policy-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, hint: 'name identifies the policy; rules is an array of routing/rate-limit rules' },
    };
  }

  if (!Array.isArray(spec.rules) || spec.rules.length === 0) {
    return {
      pass: false, code: 'EP001',
      message: 'rules must be a non-empty array',
      detail: { hint: 'Add at least one rule with a match expression and a rateLimit configuration' },
    };
  }

  return { pass: true, code: 'EP001', message: `edge-policy-spec.json valid — ${spec.rules.length} rule(s)` };
}
