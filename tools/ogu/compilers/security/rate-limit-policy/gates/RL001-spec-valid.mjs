import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RL001 — spec-valid: required fields and structure */
export async function run({ dir }) {
  const specPath = join(dir, 'rate-limit-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'RL001', message: 'No rate-limit-policy.json — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'RL001', message: 'rate-limit-policy.json is not valid JSON', detail: err.message };
  }

  const violations = [];
  if (!spec.feature || typeof spec.feature !== 'string') violations.push('Missing field: feature');
  if (!Array.isArray(spec.endpoints) || spec.endpoints.length === 0) violations.push('Missing field: endpoints (non-empty array required)');

  if (Array.isArray(spec.endpoints)) {
    spec.endpoints.forEach((ep, i) => {
      if (!ep.path) violations.push(`endpoints[${i}]: missing field "path"`);
      if (!ep.method) violations.push(`endpoints[${i}]: missing field "method"`);
      if (!ep.sensitivity) violations.push(`endpoints[${i}]: missing field "sensitivity"`);
    });
  }

  if (violations.length > 0) {
    return { pass: false, code: 'RL001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'RL001', message: `Spec valid — ${spec.endpoints.length} endpoint(s) declared` };
}
