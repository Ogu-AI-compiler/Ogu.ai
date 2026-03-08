import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MM001 — spec-valid
 * Validates that monitoring-spec.json exists and contains all required fields.
 *
 * Why:
 * - A monitoring config without a declared drift metric is a placeholder:
 *   the monitoring system will run but not detect model degradation.
 * - Without alert_threshold, the system generates alerts on every data change,
 *   causing alert fatigue, or generates no alerts, causing silent failures.
 * - Declaring retraining_trigger as a machine-readable field enables automated
 *   retraining pipelines to trigger on the correct conditions.
 *
 * Escape hatch: none — all production models need a monitoring spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'monitoring-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'MM001', message: 'monitoring-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'MM001', message: 'monitoring-spec.json is invalid JSON' }; }

  const required = ['model_name', 'drift_metric', 'alert_threshold', 'retraining_trigger'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'MM001', message: `monitoring-spec.json missing: ${missing.join(', ')}` };
  }

  return { pass: true, code: 'MM001', message: `Spec valid: "${spec.model_name}", drift: ${spec.drift_metric}` };
}
