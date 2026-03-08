import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FP001 — sklearn-pipeline-used
 * Feature engineering must be wrapped in a sklearn Pipeline or ColumnTransformer,
 * not applied as standalone sequential transformations.
 *
 * Why:
 * - A Pipeline enforces fit-on-train, transform-train-and-test consistently.
 *   Without it, the most common error is fitting on all data accidentally.
 * - Pipelines serialize to a single object: pickle(pipeline) saves all
 *   transformers AND the model together. Without Pipeline, feature engineering
 *   state (fitted scalers, encoders) is separate from the model and easily lost.
 * - Pipelines work transparently with cross-validation (GridSearchCV):
 *   CV folds each see only their training fold for fitting transformers.
 *   Without Pipeline, transformers see all data before CV folding — data leakage.
 * - Pipeline.predict() applies all preprocessing automatically at serving time.
 *   Without it, serving code must manually replicate all preprocessing steps
 *   in exactly the right order — a maintenance and correctness nightmare.
 *
 * Escape hatch: # @no-pipeline-ok: <reason> at module level for cases where
 * Pipeline genuinely cannot be used (e.g., custom transformer requiring
 * intermediate DataFrame operations not compatible with sklearn API).
 */

const PIPELINE_PATTERNS = [
  /from sklearn\.pipeline import Pipeline/,
  /from sklearn\.pipeline import make_pipeline/,
  /Pipeline\s*\(\s*steps\s*=/,
  /make_pipeline\s*\(/,
  /ColumnTransformer\s*\(/,
  /make_column_transformer\s*\(/,
  /FeatureUnion\s*\(/,
];

// Evidence of manual sequential transforms (anti-pattern)
const SEQUENTIAL_FIT_RE = /\.fit_transform\s*\([^)]+\)\s*\n.*\.fit_transform\s*\(/s;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'FP001', message: 'No Python files — pipeline check skipped', skipped: true };
  }

  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');
    if (/@no-pipeline-ok/.test(text)) {
      return { pass: true, code: 'FP001', message: '@no-pipeline-ok — Pipeline exempted', skipped: true };
    }
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasPipeline = PIPELINE_PATTERNS.some(p => p.test(content));

  if (!hasPipeline) {
    return {
      pass: false, code: 'FP001',
      message: 'No sklearn Pipeline or ColumnTransformer used',
      detail: 'Wrap feature engineering in a Pipeline:\n\n' +
        '  from sklearn.pipeline import Pipeline\n' +
        '  from sklearn.preprocessing import StandardScaler\n' +
        '  from sklearn.impute import SimpleImputer\n\n' +
        '  preprocessor = Pipeline([\n' +
        '      ("impute",  SimpleImputer(strategy="median")),\n' +
        '      ("scale",   StandardScaler()),\n' +
        '  ])\n\n' +
        '  full_pipeline = Pipeline([\n' +
        '      ("preprocess", preprocessor),\n' +
        '      ("model",      XGBClassifier(**cfg.model)),\n' +
        '  ])\n' +
        '  full_pipeline.fit(X_train, y_train)\n' +
        '  joblib.dump(full_pipeline, "pipeline.joblib")  # saves EVERYTHING',
    };
  }

  return { pass: true, code: 'FP001', message: 'sklearn Pipeline or ColumnTransformer used' };
}
