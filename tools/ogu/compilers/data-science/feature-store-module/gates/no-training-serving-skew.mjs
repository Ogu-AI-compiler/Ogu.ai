import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FS006 — no-training-serving-skew
 * Feature store code must not apply transformations at serving time that
 * differ from those applied during training — the most common production ML failure.
 *
 * Why:
 * - Training-serving skew is the single most common cause of production ML
 *   failures. It occurs when the features fed to the model at serving time
 *   are computed differently than the features the model was trained on.
 * - Common examples:
 *   - fit_transform() used during training, but a different scaler (with
 *     different statistics) used at serving time
 *   - pd.get_dummies() creates different column order depending on data seen —
 *     training data vs serving data may have different category orderings
 *   - Custom transforms applied in training notebooks but not in serving API
 * - The fix: use sklearn Pipeline (saves fitted transformers), or explicitly
 *   verify that serving transforms use the same fitted artifacts as training.
 *
 * Escape hatch: # @skew-ok: <reason> for intentional serving-time transforms
 * that differ from training (e.g., real-time feature computation that wasn't
 * available in training data).
 */


// Training-serving skew: training uses different feature transformations than serving
// This gate checks that transformations are defined once (in the feature store) not twice
export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: true, code: 'FS004', message: 'No Python files to check', skipped: true };

  const violations = [];

  for (const f of pyFiles) {
    const content = readFileSync(join(dir, f), 'utf8');
    const lines = content.split('\n');

    // Detect inline transformations that should be in feature store (not at training/serving time)
    const inlineScaling = lines.filter((l, i) => {
      const trimmed = l.trim();
      // fit_transform in feature computation context (not in pipeline)
      return /\.fit_transform\s*\(/.test(trimmed) && !/Pipeline|ColumnTransformer/.test(content.substring(0, content.indexOf(l)));
    });

    if (inlineScaling.length > 0) {
      violations.push(`${f}: .fit_transform() used outside sklearn Pipeline — transformation may differ between training and serving`);
    }

    // Detect manual encoding that should be centralized
    const manualEncoding = lines.filter(l =>
      /pd\.get_dummies\s*\(/.test(l) ||
      /LabelEncoder\(\)\.fit_transform/.test(l)
    );
    if (manualEncoding.length > 0) {
      violations.push(`${f}: inline encoding (pd.get_dummies/LabelEncoder) — centralize in feature store transformation to avoid skew`);
    }

    // Detect feature computation that duplicates transformation
    const trainingBlock = /# training|def.*train|X_train.*=/.test(content);
    const servingBlock = /# serving|def.*predict|def.*serve|def.*infer/.test(content);
    const hasTransformInBoth = trainingBlock && servingBlock &&
      /StandardScaler|MinMaxScaler|normalize|log1p/.test(content);

    if (hasTransformInBoth) {
      violations.push(`${f}: feature transformation appears in both training and serving context — risk of skew`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'FS004',
      message: `Training-serving skew risk detected`,
      detail: violations.join('\n') + '\nDefine transformations once in the feature store, not separately in training and serving'
    };
  }

  return { pass: true, code: 'FS004', message: 'No training-serving skew patterns detected' };
}
