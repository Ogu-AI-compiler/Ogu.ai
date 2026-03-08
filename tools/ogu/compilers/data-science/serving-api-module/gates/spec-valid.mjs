import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SA001 — spec-valid
 * Validates that serving-spec.json exists and contains all required fields.
 *
 * Why:
 * - A serving API without a declared latency SLO has no performance contract:
 *   it may be deployed to production with no bound on response time.
 * - Requiring input_schema and output_schema declarations enables automated
 *   schema validation gate checks and prevents undocumented API changes.
 * - Declaring the framework enables environment validation: the CI can verify
 *   the correct version of FastAPI/Flask/Triton is installed.
 *
 * Escape hatch: none — all production serving APIs need a machine-readable spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'serving-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'SA001', message: 'serving-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'SA001', message: 'serving-spec.json is invalid JSON' }; }

  const required = ['endpoint', 'framework', 'max_latency_ms', 'input_schema', 'output_schema'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'SA001', message: `serving-spec.json missing: ${missing.join(', ')}` };
  }

  if (typeof spec.max_latency_ms !== 'number' || spec.max_latency_ms <= 0) {
    return { pass: false, code: 'SA001', message: `max_latency_ms must be a positive number, got: ${spec.max_latency_ms}` };
  }

  return { pass: true, code: 'SA001', message: `Spec valid: ${spec.framework} endpoint "${spec.endpoint}", SLO: ${spec.max_latency_ms}ms` };
}
