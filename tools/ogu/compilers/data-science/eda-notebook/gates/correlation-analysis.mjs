import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN005 — correlation-analysis
 * EDA notebooks must analyze feature correlations to detect multicollinearity
 * and identify the most predictive features.
 *
 * Why:
 * - Multicollinearity (highly correlated features) inflates model variance,
 *   makes coefficients unstable, and degrades model interpretability.
 *   For linear models, VIF > 10 indicates severe multicollinearity.
 * - Correlation with the target variable identifies the most informative
 *   features — a quick sanity check that the dataset actually contains
 *   signal predictive of the outcome.
 * - Zero or near-zero correlation with target (while having significant
 *   feature-to-feature correlations) is a warning sign: the features
 *   may explain each other but not the outcome.
 * - Correlation analysis also identifies redundant feature pairs that
 *   can be dropped to reduce dimensionality without information loss.
 *
 * Required: correlation matrix/heatmap AND correlation with target variable.
 *
 * Escape hatch: add "skipCorrelations": true to eda-spec.json for tasks
 * where correlation is not meaningful (text features, image features,
 * unsupervised learning without a target).
 */

const CORRELATION_MATRIX_PATTERNS = [
  /\.corr\s*\(\)/,
  /sns\.heatmap/,
  /correlation.?matrix/i,
  /pairplot\s*\(/,
  /pd\.plotting\.scatter_matrix/,
];

const TARGET_CORRELATION_PATTERNS = [
  /\.corr\s*\(\)\s*\[['"`]\w+['"`]\]/,   // df.corr()['target']
  /corr.*target|target.*corr/i,
  /\.corrwith\s*\(/,
  /mutual_info|SelectKBest/,             // feature importance alternatives
];

function extractCode(dir) {
  const parts = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) parts.push((cell.source ?? []).join(''));
      } catch { /* skip */ }
    } else if (file.endsWith('.py')) {
      parts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'eda-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'EN005', message: 'eda-spec.json not readable' }; }

  if (spec.skipCorrelations === true) {
    return { pass: true, code: 'EN005', message: 'skipCorrelations: true — not applicable for this data type', skipped: true };
  }

  const content = extractCode(dir);
  if (!content.trim()) {
    return { pass: false, code: 'EN005', message: 'No analysis files found' };
  }

  const hasMatrix   = CORRELATION_MATRIX_PATTERNS.some(p => p.test(content));
  const hasTargetCorr = TARGET_CORRELATION_PATTERNS.some(p => p.test(content));

  if (!hasMatrix) {
    return {
      pass: false, code: 'EN005',
      message: 'No correlation matrix or pairplot found',
      detail: 'Add correlation analysis:\n\n' +
        '  import seaborn as sns\n' +
        '  corr_matrix = df.corr()\n' +
        '  plt.figure(figsize=(12, 10))\n' +
        '  sns.heatmap(corr_matrix, annot=True, fmt=".2f", cmap="coolwarm",\n' +
        '              center=0, square=True)\n' +
        '  plt.title("Feature Correlation Matrix")\n' +
        '  plt.savefig("correlation_matrix.png")',
    };
  }

  if (!hasTargetCorr && spec.target_column) {
    return {
      pass: false, code: 'EN005',
      message: `Correlation matrix present but target correlation missing (target: "${spec.target_column}")`,
      detail: `Add target correlation:\n  print(df.corr()["${spec.target_column}"].sort_values(ascending=False))`,
    };
  }

  return {
    pass: true, code: 'EN005',
    message: 'Correlation analysis present — feature matrix and target correlations',
  };
}
