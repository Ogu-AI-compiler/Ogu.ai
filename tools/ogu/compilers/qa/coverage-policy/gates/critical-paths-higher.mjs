import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA016 — critical-paths-higher
 * Library and utility code (src/lib/**, src/utils/**) must have per-file
 * thresholds that are strictly higher than the global threshold.
 *
 * Reasoning: library functions are reused everywhere. A bug in a utility
 * has blast radius equal to every caller. They deserve tighter coverage.
 *
 * Detected patterns (any of these in perFile keys triggers check):
 *   src/lib/**   src/utils/**   src/helpers/**   src/shared/**
 *
 * If none of these are declared, this gate suggests adding them but does
 * not fail — the project may have a different structure.
 *
 * If they ARE declared, their lines threshold must be > global.lines.
 *
 * Skipped: spec.criticalPathsExempt: true
 */

const CRITICAL_PATTERNS = ['src/lib/', 'src/utils/', 'src/helpers/', 'src/shared/'];

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'coverage-policy-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA016', message: 'coverage-policy-spec.json not readable' };
  }

  if (spec.criticalPathsExempt === true) {
    return { pass: true, code: 'QA016', message: 'criticalPathsExempt: true — gate skipped', skipped: true };
  }

  const globalLines = spec.global?.lines ?? 0;
  const perFile = spec.perFile || {};
  const perFileKeys = Object.keys(perFile);

  // Find which critical patterns are declared
  const declaredCritical = perFileKeys.filter(k =>
    CRITICAL_PATTERNS.some(p => k.includes(p.replace('src/', '')))
  );

  if (declaredCritical.length === 0) {
    // No critical paths declared — suggest but don't fail
    return {
      pass: true, code: 'QA016',
      message: `No critical path patterns (${CRITICAL_PATTERNS.join(', ')}) found in perFile — consider adding higher thresholds for library code`,
      skipped: true,
    };
  }

  // Verify declared critical paths are above global
  const violations = [];
  for (const key of declaredCritical) {
    const thresholds = perFile[key] || {};
    const lineThresh = thresholds.lines;
    if (typeof lineThresh === 'number' && lineThresh <= globalLines) {
      violations.push(`"${key}" lines:${lineThresh}% is not higher than global lines:${globalLines}%`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA016',
      message: `Critical path coverage not above global threshold`,
      detail: violations.join('\n') + `\n\nIncrease lines threshold for critical paths above the global ${globalLines}%.`,
    };
  }

  return {
    pass: true, code: 'QA016',
    message: `${declaredCritical.length} critical path(s) have coverage above global (${globalLines}%)`,
  };
}
