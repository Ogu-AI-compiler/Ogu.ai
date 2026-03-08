import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FP003 — no-chained-assignment
 * Feature pipeline code must not use pandas chained assignment patterns
 * that produce SettingWithCopyWarning and silently fail to modify data.
 *
 * Why:
 * - Chained assignment (df[mask]['col'] = value) creates a copy of the
 *   filtered DataFrame, modifies the copy, and silently discards the change.
 *   The original DataFrame is unchanged. This is not a warning to suppress —
 *   it's a data loss bug.
 * - The pandas SettingWithCopyWarning exists precisely because this pattern
 *   is so common and the failure so silent. Teams often silence the warning
 *   with pd.options.mode.chained_assignment = None, which hides the bug.
 * - Common manifestation: feature engineering that appears to work in
 *   interactive notebooks but produces different features in pipeline runs,
 *   because notebook state (cached DataFrames) masks the copy behavior.
 *
 * Correct patterns:
 *   df.loc[mask, 'col'] = value       # explicit loc indexing
 *   df = df.assign(new_col=lambda x: x['col'] * 2)  # assign returns new df
 *   df['col'] = df['col'].fillna(0)   # single-level indexing
 *
 * Escape hatch: # @chained-ok: <reason> on the offending line.
 */

// Pattern: df[something][something] = value — chained subscript assignment
const CHAINED_ASSIGN_RE = /\w+\[.+\]\[.+\]\s*=/;

// Pattern: silencing the warning
const SILENCE_WARNING_RE = /chained_assignment\s*=\s*None/;

// Pattern: copy() being called (defensive copy, acceptable)
const COPY_RE = /\.copy\s*\(\)/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'FP003', message: 'No Python files — chained assignment check skipped', skipped: true };
  }

  const violations = [];
  let silencesWarning = false;

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@chained-ok/.test(line) || (i > 0 && /@chained-ok/.test(lines[i - 1]))) continue;

      if (SILENCE_WARNING_RE.test(line)) {
        silencesWarning = true;
        violations.push(`${file}:${i + 1} — silencing SettingWithCopyWarning hides bugs`);
      } else if (CHAINED_ASSIGN_RE.test(line) && !COPY_RE.test(line)) {
        violations.push(`${file}:${i + 1} — chained assignment: ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    const mainIssue = silencesWarning
      ? 'SettingWithCopyWarning is silenced — chained assignment bugs will go undetected'
      : `${violations.length} chained assignment(s) — changes may be silently lost`;

    return {
      pass: false, code: 'FP003',
      message: mainIssue,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nReplace:\n  df[df["age"] > 18]["score"] = 1  # wrong — modifies copy\n\nWith:\n' +
        '  df.loc[df["age"] > 18, "score"] = 1  # correct\n' +
        '  # or\n' +
        '  df = df.assign(score=np.where(df["age"] > 18, 1, 0))',
    };
  }

  return { pass: true, code: 'FP003', message: 'No chained assignment patterns detected' };
}
