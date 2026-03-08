/**
 * Why:
 * The target variable must not appear as an input feature in the transformer
 * pipeline. Including the target (or any proxy derived from it) in the feature
 * set causes the model to "cheat" — it achieves perfect or near-perfect
 * training metrics while being completely useless on new data.
 *
 * Common leakage patterns:
 * - The target column name appearing in ColumnTransformer inputs
 * - `target_mean` or `target_encoded` features (mean encoding derived from y)
 * - Features computed after the target is known (e.g., "days_to_outcome"
 *   computed from an outcome date that was set when the target occurred)
 *
 * This gate checks:
 * 1. The target variable from spec does not appear in transformer feature lists
 * 2. No `target_mean`, `_target_enc`, `target_encoded` derived features
 *
 * Escape hatch: add `# @target-in-features-ok: <reason>` to suppress for
 * legitimate cases (e.g., multi-target learning where one target predicts another).
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DERIVED_TARGET_RE = /target_mean|target_enc|_target\b|target_label/i;

export async function run({ dir }) {
  const specPath = join(dir, 'feature-pipeline-spec.json');
  const pyFiles  = readdirSync(dir).filter(f => f.endsWith('.py'));

  if (!pyFiles.length) return { pass: true, code: 'FP005', message: 'No Python files — skipped', skipped: true };

  const content  = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const allLines = content.split('\n');
  const violations = [];

  // Check derived target features regardless of spec
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    if (line.trim().startsWith('#')) continue;
    if (/@target-in-features-ok/.test(line)) continue;
    if (DERIVED_TARGET_RE.test(line) && !/drop|remove|exclude/.test(line)) {
      violations.push(`${i + 1}: possible derived target feature — ${line.trim().slice(0, 80)}`);
    }
  }

  // If spec exists, check target column name in feature inputs
  if (existsSync(specPath)) {
    let spec;
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { /* skip */ }

    if (spec?.target) {
      const targetName = spec.target;
      const targetInFeatures = spec.features?.includes(targetName);
      if (targetInFeatures) {
        violations.unshift(`spec: target "${targetName}" is also listed in features — remove it from the features array`);
      }

      // Check if target column name appears inside ColumnTransformer feature lists
      const ctPattern = new RegExp(`["']${targetName}["'].*ColumnTransformer|ColumnTransformer[\\s\\S]{0,300}["']${targetName}["']`);
      if (ctPattern.test(content)) {
        violations.push(`Target column "${targetName}" referenced inside ColumnTransformer inputs`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'FP005',
      message: `${violations.length} potential target leakage issue(s)`,
      detail: violations.join('\n') + '\n\n' +
              'Target leakage means the model learns from information that would not be\n' +
              'available at prediction time, producing misleadingly high metrics.\n' +
              'Add # @target-in-features-ok: <reason> if intentional.',
    };
  }
  return { pass: true, code: 'FP005', message: 'No target leakage patterns detected' };
}
