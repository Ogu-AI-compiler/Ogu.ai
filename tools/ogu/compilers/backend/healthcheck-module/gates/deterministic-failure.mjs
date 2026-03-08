import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * HC006 — deterministic-failure
 * A failing dependency must produce a deterministic, predictable result.
 * No: swallowed errors, generic "error" string, or undefined status.
 * Yes: { status: "unhealthy"|"degraded", error: string, latencyMs: number }
 */

const DETERMINISTIC_PATTERNS = [
  /status\s*:\s*['"`]unhealthy['"`]/,
  /status\s*:\s*['"`]degraded['"`]/,
  /catch\s*\([^)]*\)\s*\{[\s\S]*?status/,
  /\.catch\s*\([^)]*=>/,
];

const SWALLOW_PATTERNS = [
  /catch\s*\([^)]*\)\s*\{\s*\}/     // empty catch block — swallowed error
];

function findReadinessFile(dir) {
  const candidates = [
    'src/lib/health/readiness.ts',
    'src/health/readiness.ts',
    'lib/health/readiness.ts',
  ];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}

export async function run({ dir }) {
  const readinessFile = findReadinessFile(dir);
  if (!readinessFile) {
    return { pass: true, code: 'HC006', message: 'No readiness file yet — deterministic-failure gate skipped', skipped: true };
  }

  const content = readFileSync(readinessFile, 'utf8');

  // Check for swallowed errors
  const hasSwallow = SWALLOW_PATTERNS.some(p => p.test(content));
  if (hasSwallow) {
    return {
      pass: false, code: 'HC006',
      message: 'Empty catch block detected — dependency failure is silently swallowed',
      detail: 'Always return a deterministic result on failure:\ncatch (err) { return { status: "unhealthy", error: err.message, latencyMs } }'
    };
  }

  const hasDeterministic = DETERMINISTIC_PATTERNS.some(p => p.test(content));
  if (!hasDeterministic) {
    return {
      pass: false, code: 'HC006',
      message: 'No deterministic failure handling found in readiness check',
      detail: 'Catch block must return { status: "unhealthy"|"degraded", error: string, latencyMs: number }'
    };
  }

  return { pass: true, code: 'HC006', message: 'Dependency failure produces deterministic unhealthy/degraded result' };
}
