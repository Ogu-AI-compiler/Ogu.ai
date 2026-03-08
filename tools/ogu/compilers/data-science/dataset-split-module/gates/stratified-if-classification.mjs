/**
 * Why:
 * Classification problems must use stratified splitting to preserve the class
 * distribution across train, validation, and test sets. Without stratification:
 * - Rare classes may be entirely absent from the test set (silent evaluation gap)
 * - Class imbalance ratios differ between splits, producing misleading metrics
 * - Minority class F1 scores are computed on different distributions per run
 *
 * What to look for: `train_test_split` without `stratify=y` on classification tasks.
 * For k-fold: `KFold` without `StratifiedKFold`.
 *
 * This gate checks both the spec (task type) and the code pattern.
 *
 * Exemptions (auto-skipped):
 * - Regression tasks (continuous target, stratification not applicable)
 * - Time-series tasks (temporal splits are incompatible with stratification)
 * - Unsupervised learning (no target to stratify on)
 *
 * Escape hatch: add `# @no-stratify-ok: <reason>` to suppress (e.g., ordinal
 * regression where class distribution is uniform by design).
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const CLASSIFICATION_TASKS = new Set(['classification', 'binary_classification', 'multiclass', 'multilabel']);
const REGRESSION_TASKS     = new Set(['regression', 'time_series', 'forecasting', 'unsupervised', 'clustering']);

export async function run({ dir }) {
  // Check spec for task type
  const specPath = join(dir, 'split-spec.json');
  let task = null;
  if (existsSync(specPath)) {
    try {
      const spec = JSON.parse(readFileSync(specPath, 'utf8'));
      task = spec.task?.toLowerCase();
    } catch { /* continue */ }
  }

  // Auto-skip for non-classification tasks
  if (task && REGRESSION_TASKS.has(task)) {
    return { pass: true, code: 'SP005', message: `Task="${task}" — stratification not applicable`, skipped: true };
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: true, code: 'SP005', message: 'No Python files — skipped', skipped: true };

  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  if (/@no-stratify-ok/.test(content)) {
    return { pass: true, code: 'SP005', message: 'Stratification explicitly waived via @no-stratify-ok' };
  }

  const hasSplit = /train_test_split\s*\(/.test(content);
  const hasKFold = /KFold\s*\(/.test(content);

  if (!hasSplit && !hasKFold) {
    return { pass: true, code: 'SP005', message: 'No split calls detected — skipped', skipped: true };
  }

  const hasStratify        = /stratify\s*=/.test(content);
  const hasStratifiedKFold = /StratifiedKFold\s*\(/.test(content);

  // For classification tasks: require stratification
  if (task && CLASSIFICATION_TASKS.has(task)) {
    if (!hasStratify && !hasStratifiedKFold) {
      return {
        pass: false, code: 'SP005',
        message: `Classification task without stratified split`,
        detail: `Task type "${task}" requires stratified splitting.\n` +
                '  train_test_split(X, y, stratify=y)  # ✓\n' +
                '  StratifiedKFold(n_splits=5)          # ✓\n' +
                '  KFold(n_splits=5)                    # ✗ class imbalance may cause silent gaps\n' +
                'Add # @no-stratify-ok: <reason> if stratification is genuinely not needed.',
      };
    }
    return { pass: true, code: 'SP005', message: 'Stratified split confirmed for classification task' };
  }

  // No task in spec — check code heuristically
  const hasClassificationCode = /classification|LogisticRegression|RandomForestClassifier|XGBClassifier|accuracy_score|f1_score/.test(content);
  if (hasClassificationCode && !hasStratify && !hasStratifiedKFold) {
    return {
      pass: false, code: 'SP005',
      message: 'Classification patterns detected but no stratified split',
      detail: 'Add stratify=y to train_test_split() or use StratifiedKFold.\n' +
              'Set "task": "classification" in split-spec.json to make this explicit.\n' +
              'Add # @no-stratify-ok: <reason> to suppress if regression-style split is intentional.',
    };
  }

  return { pass: true, code: 'SP005', message: hasStratify || hasStratifiedKFold ? 'Stratified split present' : 'No classification task detected — stratification check skipped' };
}
