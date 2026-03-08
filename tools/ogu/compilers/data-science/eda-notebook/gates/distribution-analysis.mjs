import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN004 — distribution-analysis
 * EDA notebooks must analyze feature distributions to inform preprocessing decisions.
 *
 * Why:
 * - Distribution analysis drives critical modeling decisions:
 *   - Skewed distributions → log/sqrt transform or robust scalers
 *   - Heavy-tailed distributions → outlier handling strategy
 *   - Multi-modal distributions → potential subgroup structure requiring stratification
 *   - Discrete distributions masquerading as continuous → different encoding needed
 * - Skipping distribution analysis leads to: inappropriate feature scaling,
 *   model degradation from unhandled outliers, missed opportunities for
 *   feature transformation that could dramatically improve model performance.
 * - The standard EDA workflow: visualize distributions → identify skew/outliers
 *   → decide transforms → validate transforms improve model readiness.
 *
 * Required: both visualization AND quantitative skewness/outlier metrics.
 * Visualization alone is insufficient (subjective). Quantitative alone
 * misses multi-modality and shape that plots reveal.
 *
 * Escape hatch: add "skipDistributions": true to eda-spec.json for
 * non-tabular data (text, images, audio) where distribution analysis
 * is replaced by domain-specific analysis.
 */

const VISUALIZATION_PATTERNS = [
  /\.hist\s*\(/,
  /\.boxplot\s*\(/,
  /sns\.(?:distplot|histplot|kdeplot|boxplot|violinplot)/,
  /plt\.hist\s*\(/,
  /value_counts\s*\(\)/,
  /plot\s*\(\s*kind\s*=\s*['"]hist/,
];

const QUANTITATIVE_PATTERNS = [
  /\.skew\s*\(\)/,
  /\.kurtosis\s*\(\)/,
  /\.describe\s*\(\)/,
  /\.quantile\s*\(/,
  /scipy\.stats\.skewnorm/,
  /iqr\s*=|IQR\s*=/i,
  /\.std\s*\(\)|\.var\s*\(\)/,
  /outlier/i,
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
  catch { return { pass: false, code: 'EN004', message: 'eda-spec.json not readable' }; }

  if (spec.skipDistributions === true) {
    return { pass: true, code: 'EN004', message: 'skipDistributions: true — non-tabular data', skipped: true };
  }

  const content = extractCode(dir);
  if (!content.trim()) {
    return { pass: false, code: 'EN004', message: 'No analysis files found' };
  }

  const hasViz  = VISUALIZATION_PATTERNS.some(p => p.test(content));
  const hasQuant = QUANTITATIVE_PATTERNS.some(p => p.test(content));

  if (!hasViz && !hasQuant) {
    return {
      pass: false, code: 'EN004',
      message: 'No distribution analysis found',
      detail: 'Add distribution analysis:\n\n' +
        '  # Visualize\n' +
        '  df.hist(figsize=(16, 10), bins=30)\n' +
        '  plt.tight_layout(); plt.savefig("distributions.png")\n\n' +
        '  # Quantify\n' +
        '  print("Skewness:")\n' +
        '  print(df.skew().sort_values(ascending=False))\n\n' +
        '  # Outliers via IQR\n' +
        '  Q1, Q3 = df.quantile(0.25), df.quantile(0.75)\n' +
        '  IQR = Q3 - Q1\n' +
        '  outliers = ((df < Q1 - 1.5*IQR) | (df > Q3 + 1.5*IQR)).sum()\n' +
        '  print("Outlier count per feature:")\n  print(outliers)',
    };
  }

  if (!hasViz) {
    return {
      pass: false, code: 'EN004',
      message: 'Quantitative statistics found but no distribution visualization',
      detail: 'Add plots: df.hist() or sns.histplot() — numbers alone miss modality and shape.',
    };
  }

  if (!hasQuant) {
    return {
      pass: false, code: 'EN004',
      message: 'Distribution plots found but no quantitative skewness/outlier analysis',
      detail: 'Add: print(df.skew()) and outlier detection via IQR or Z-score.',
    };
  }

  return { pass: true, code: 'EN004', message: 'Distribution analysis present — visualization + quantitative metrics' };
}
