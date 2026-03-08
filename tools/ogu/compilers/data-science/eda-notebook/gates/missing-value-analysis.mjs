import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN003 — missing-value-analysis
 * EDA notebooks must quantify missing values AND document the imputation strategy.
 *
 * Why:
 * - Simply knowing that missing values exist is insufficient. The EDA must
 *   answer: How many? Which columns? What pattern (MCAR/MAR/MNAR)?
 * - Missing value handling is one of the highest-impact modeling decisions:
 *   - Drop rows → may introduce selection bias
 *   - Mean impute → distorts distribution, attenuates correlations
 *   - MICE/KNN impute → preserves relationships but adds complexity
 * - Not documenting the chosen strategy means the choice is implicit in
 *   code and invisible to reviewers who need to validate it.
 * - The pattern for detecting MCAR vs MNAR matters: are values missing
 *   randomly or correlated with the target? This is a bias risk.
 *
 * Escape hatch: add "noMissingValues": true to eda-spec.json for datasets
 * that genuinely have no missing values (rare but valid for synthetic data).
 */

const QUANTIFY_PATTERNS = [
  /\.isnull\s*\(\)\s*\.sum/,
  /\.isna\s*\(\)\s*\.sum/,
  /\.isnull\s*\(\)\s*\.mean/,
  /msno\./,
  /missingno/,
  /null_count|na_count|missing_count/i,
];

const STRATEGY_PATTERNS = [
  /\.fillna\s*\(/,
  /\.dropna\s*\(/,
  /SimpleImputer|KNNImputer|IterativeImputer/,
  /impute|imputation/i,
  /median\s*impute|mean\s*impute|mode\s*impute/i,
  /forward.fill|backward.fill|ffill|bfill/,
];

function extractAllText(dir) {
  const parts = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) parts.push((cell.source ?? []).join(''));
      } catch { /* skip */ }
    } else if (file.endsWith('.py') || file.endsWith('.md')) {
      parts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'eda-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'EN003', message: 'eda-spec.json not readable' }; }

  if (spec.noMissingValues === true) {
    return { pass: true, code: 'EN003', message: 'noMissingValues: true — missing value analysis skipped', skipped: true };
  }

  const content = extractAllText(dir);
  if (!content.trim()) {
    return { pass: false, code: 'EN003', message: 'No notebook or analysis files found' };
  }

  const hasQuantification = QUANTIFY_PATTERNS.some(p => p.test(content));
  const hasStrategy       = STRATEGY_PATTERNS.some(p => p.test(content));

  if (!hasQuantification && !hasStrategy) {
    return {
      pass: false, code: 'EN003',
      message: 'No missing value analysis found',
      detail: 'Add missing value quantification:\n' +
        '  missing = df.isnull().sum()\n' +
        '  missing_pct = (df.isnull().mean() * 100).round(2)\n' +
        '  print(missing[missing > 0])\n\n' +
        'Then document imputation strategy:\n' +
        '  df["age"].fillna(df["age"].median(), inplace=True)  # median: robust to outliers\n' +
        '  df.dropna(subset=["target"])  # drop rows with missing target',
    };
  }

  if (!hasQuantification) {
    return {
      pass: false, code: 'EN003',
      message: 'Imputation found but missing value quantification absent',
      detail: 'Before imputing, quantify:\n  print(df.isnull().sum())\n  print(df.isnull().mean().sort_values(ascending=False))',
    };
  }

  if (!hasStrategy) {
    return {
      pass: false, code: 'EN003',
      message: 'Missing values quantified but no imputation/handling strategy found',
      detail: 'After quantifying missing values, document how they will be handled:\n' +
        '  # Option 1: Drop rows (if <5% missing and random)\n  df.dropna(subset=["income"])\n' +
        '  # Option 2: Median impute (numeric, skewed)\n  df["age"].fillna(df["age"].median())\n' +
        '  # Option 3: KNN impute (when missing correlated with other features)\n  from sklearn.impute import KNNImputer',
    };
  }

  return {
    pass: true, code: 'EN003',
    message: 'Missing values quantified and imputation strategy documented',
  };
}
