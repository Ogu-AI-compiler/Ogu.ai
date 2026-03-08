import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DP001 — spec-valid
 * Validates that pipeline-spec.json exists and contains all required fields.
 *
 * Why:
 * - Without a spec, a pipeline is a black box: no declared stages, no
 *   input/output formats, no way to validate cross-pipeline compatibility.
 * - Declaring stages explicitly enables dependency graph construction,
 *   impact analysis, and automated documentation of the data flow.
 * - Declaring input/output formats enables automated schema compatibility
 *   checks between producers and consumers in the pipeline DAG.
 *
 * Escape hatch: none — all data pipelines must have a machine-readable spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'pipeline-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'DP001', message: 'pipeline-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DP001', message: 'pipeline-spec.json is invalid JSON' }; }

  const required = ['pipeline_name', 'stages', 'input_format', 'output_format'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'DP001', message: `pipeline-spec.json missing: ${missing.join(', ')}` };
  }

  if (!Array.isArray(spec.stages) || !spec.stages.length) {
    return { pass: false, code: 'DP001', message: 'stages must be a non-empty array' };
  }

  return { pass: true, code: 'DP001', message: `Spec valid: ${spec.pipeline_name}, ${spec.stages.length} stages` };
}
