import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * FP008 — feature-names-exported
 * The feature pipeline must export feature names alongside the fitted pipeline.
 *
 * Why:
 * - When a pipeline serializes transformers, it preserves the order of features
 *   but not their names (except in newer sklearn with set_output(transform="pandas")).
 *   At serving time, inputs must be in exactly the same column order as training.
 * - Without exported feature names, serving code cannot verify that incoming
 *   features match what the model expects. Column order bugs are silent:
 *   the model accepts a DataFrame with wrong column order and produces wrong
 *   predictions without any error.
 * - Feature names are also critical for model debugging, explainability tools
 *   (SHAP, LIME), and drift monitoring — all require knowing which features
 *   correspond to which model input dimensions.
 *
 * Required: the pipeline or a companion file exports feature names.
 * Acceptable patterns:
 * - pipeline.feature_names_in_ (sklearn ≥1.0)
 * - json.dump(feature_names, open("feature_names.json", "w"))
 * - joblib.dump(feature_names, "feature_names.joblib")
 * - FEATURE_NAMES = [...] constant + exported in metadata
 *
 * Escape hatch: add "featureNamesInArtifact": true to feature-spec.json
 * if feature names are embedded in a custom artifact format.
 */

const FEATURE_NAME_EXPORT_PATTERNS = [
  /feature_names_in_/,
  /get_feature_names_out\s*\(\)/,
  /feature_names\s*=\s*\[/,
  /FEATURE_NAMES\s*=\s*\[/,
  /json\.dump\s*\([^)]*feature/i,
  /joblib\.dump\s*\([^)]*feature/i,
  /metadata\s*\[.*feature.*\]\s*=/i,
  /["']feature_names["']\s*:/,
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'feature-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'FP008', message: 'feature-spec.json not readable' }; }

  if (spec.featureNamesInArtifact === true) {
    return { pass: true, code: 'FP008', message: 'Feature names embedded in custom artifact', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'FP008', message: 'No Python files — feature names check skipped', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasExport = FEATURE_NAME_EXPORT_PATTERNS.some(p => p.test(content));

  if (!hasExport) {
    return {
      pass: false, code: 'FP008',
      message: 'Feature names not exported alongside pipeline',
      detail: 'Export feature names after fitting:\n\n' +
        '  # Option 1: sklearn ≥1.0 built-in\n' +
        '  pipeline.fit(X_train, y_train)\n' +
        '  feature_names = pipeline.feature_names_in_.tolist()\n\n' +
        '  # Option 2: explicit export\n' +
        '  FEATURE_NAMES = ["age", "income", "city_encoded"]\n' +
        '  import json\n' +
        '  with open("feature_names.json", "w") as f:\n' +
        '      json.dump(FEATURE_NAMES, f)\n\n' +
        '  # At serving time:\n' +
        '  feature_names = json.load(open("feature_names.json"))\n' +
        '  assert list(input_df.columns) == feature_names, "Feature mismatch!"',
    };
  }

  return { pass: true, code: 'FP008', message: 'Feature names exported alongside pipeline' };
}
