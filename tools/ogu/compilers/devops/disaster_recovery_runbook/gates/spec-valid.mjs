/**
 * Gate: spec-valid (DR001)
 * Validates that dr-runbook-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields cause downstream gates (RTO/RPO parsing,
 * scenario completeness, failover targets) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['service', 'rto', 'rpo', 'scenarios'];

export async function run({ dir }) {
  const specPath = join(dir, 'dr-runbook-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'DR001',
      message: 'dr-runbook-spec.json not found',
      detail: { searched: specPath, hint: 'Create dr-runbook-spec.json with service, rto, rpo, and scenarios fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'DR001', message: `dr-runbook-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(f => spec[f] === undefined || spec[f] === null);
  if (missing.length) {
    return {
      pass: false, code: 'DR001',
      message: `dr-runbook-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED, hint: 'rto and rpo use ISO 8601 duration format (e.g., PT4H, PT30M)' },
    };
  }

  if (!Array.isArray(spec.scenarios) || spec.scenarios.length === 0) {
    return {
      pass: false, code: 'DR001',
      message: 'scenarios must be a non-empty array',
      detail: { hint: 'Add at least one DR scenario with name, trigger, steps, and owner fields' },
    };
  }

  return { pass: true, code: 'DR001', message: `dr-runbook-spec.json valid — ${spec.scenarios.length} scenario(s)` };
}
