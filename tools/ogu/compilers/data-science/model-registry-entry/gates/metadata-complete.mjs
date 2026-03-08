import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MR002 — metadata-complete
 * Model registry entries must include complete metadata for operational use.
 *
 * Why:
 * - Model metadata is the operational record of the model:
 *   who trained it, with what data, when, with what performance.
 * - Incomplete metadata makes production operations impossible:
 *   - "Which version is deployed?" requires model_version
 *   - "When was this trained?" requires trained_at
 *   - "What data did it see?" requires training_data_version
 *   - "Can we roll back?" requires artifact_path + reproducibility info
 * - Over time, teams accumulate tens of models. Without consistent metadata,
 *   the registry becomes an archaeological dig site rather than a useful tool.
 * - Regulatory requirements (GDPR, financial risk) may require complete audit
 *   trails of model lineage, training data, and performance metrics.
 *
 * Required fields: model_version, trained_at, algorithm, primary_metric,
 * metrics (object), training_data_version or training_data_hash.
 *
 * Escape hatch: add "metadataMinimal": true to registry-spec.json for
 * prototype/experimental models where full metadata is premature.
 */

const REQUIRED_FIELDS = [
  { key: 'model_version',   desc: 'version string (e.g., "v1.2.0")' },
  { key: 'trained_at',      desc: 'ISO timestamp of training run' },
  { key: 'algorithm',       desc: 'model algorithm name' },
  { key: 'metrics',         desc: 'object with performance metric values' },
];

const LINEAGE_FIELDS = ['training_data_version', 'training_data_hash', 'dataset_version', 'data_hash'];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'registry-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'MR002', message: 'registry-spec.json not readable' }; }

  if (spec.metadataMinimal === true) {
    return { pass: true, code: 'MR002', message: 'Minimal metadata mode (prototype/experimental)', skipped: true };
  }

  const metaPath = join(dir, 'model-metadata.json');
  if (!existsSync(metaPath)) {
    return {
      pass: false, code: 'MR002',
      message: 'model-metadata.json not found',
      detail: 'Create model-metadata.json with:\n' +
        '  {\n' +
        '    "model_version": "v1.0.0",\n' +
        '    "trained_at": "2024-01-15T14:22:00Z",\n' +
        '    "algorithm": "XGBClassifier",\n' +
        '    "metrics": { "f1_score": 0.87, "auc": 0.91 },\n' +
        '    "training_data_version": "2024-01-14",\n' +
        '    "run_id": "mlflow-run-abc123"\n' +
        '  }',
    };
  }

  let meta;
  try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); }
  catch { return { pass: false, code: 'MR002', message: 'model-metadata.json not parseable' }; }

  const missing = REQUIRED_FIELDS.filter(f => !meta[f.key] && meta[f.key] !== 0);

  // Check lineage — at least one lineage field required
  const hasLineage = LINEAGE_FIELDS.some(f => meta[f]);
  if (!hasLineage) {
    missing.push({ key: 'training_data_version', desc: 'or training_data_hash — data lineage identifier' });
  }

  if (missing.length) {
    return {
      pass: false, code: 'MR002',
      message: `${missing.length} required metadata field(s) missing`,
      detail: missing.map(f => `  • ${f.key}: ${f.desc}`).join('\n'),
    };
  }

  // Validate metrics is an object with at least one metric
  if (typeof meta.metrics !== 'object' || Array.isArray(meta.metrics) || Object.keys(meta.metrics).length === 0) {
    return {
      pass: false, code: 'MR002',
      message: 'metrics field must be a non-empty object',
      detail: '  "metrics": { "f1_score": 0.87, "roc_auc": 0.91 }',
    };
  }

  return {
    pass: true, code: 'MR002',
    message: `Metadata complete — ${Object.keys(meta.metrics).join(', ')} tracked for ${meta.model_version}`,
  };
}
