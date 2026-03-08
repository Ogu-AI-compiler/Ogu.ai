import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN010 — contract-eda
 * Verifies that EDA notebooks satisfy the contract: missing value analysis,
 * distribution plots, correlation analysis, and no raw data writes.
 *
 * Why:
 * - These four elements define a complete EDA: without them, the notebook
 *   is partial exploration that may miss critical data quality issues.
 * - Missing value analysis is the most commonly skipped step — and missing
 *   values cause the most silent failures in ML pipelines downstream.
 * - Distribution plots reveal skewness, outliers, and scale differences
 *   that inform preprocessing decisions; skipping them leads to untreated
 *   features that hurt model performance.
 * - No raw data writes: EDA notebooks must not modify the raw data layer.
 *   The raw data is the source of truth; any modification invalidates
 *   the audit trail of how the processed dataset was derived.
 *
 * Escape hatch: none — these are non-negotiable for production EDA.
 */

const RULES = [
  {
    id: 'has-missing-analysis',
    description: 'Missing value analysis present (.isnull(), .isna(), .info())',
    test: c => /\.isnull\(\)|\.isna\(\)|\.info\(\)|missingno/.test(c),
  },
  {
    id: 'has-distributions',
    description: 'Distribution plots present (.hist(), .boxplot(), sns.histplot, value_counts)',
    test: c => /\.hist\s*\(|\.boxplot\s*\(|sns\.hist|value_counts|sns\.boxplot|sns\.violinplot/.test(c),
  },
  {
    id: 'has-correlations',
    description: 'Correlation analysis present (.corr(), sns.heatmap, pairplot)',
    test: c => /\.corr\s*\(\)|sns\.heatmap|pairplot/.test(c),
  },
  {
    id: 'no-raw-write',
    description: 'No writes to raw data directory (raw/ must remain immutable)',
    test: c => !/to_csv.*raw\/|to_parquet.*raw\/|\.to_excel.*raw\//.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.ipynb') || f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'EN010', message: 'No notebook or Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'EN010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'EN010', message: 'All EDA contract rules passed' };
}
