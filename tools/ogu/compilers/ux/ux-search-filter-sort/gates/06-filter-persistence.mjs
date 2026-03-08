/**
 * Gate USS006 — filter-persistence
 * Spec must declare persistence: "session" | "url" | "none" | "user-preference"
 * Missing persistence means undefined behavior on page reload/navigate.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_PERSISTENCE = new Set(['session', 'url', 'none', 'user-preference']);

export async function run({ dir }) {
  const specPath = join(dir, 'search-filter-sort-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'USS006',
      message: 'search-filter-sort-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'USS006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.persistence !== 'string') {
    return {
      pass: false,
      code: 'USS006',
      message: 'persistence is missing — must be "session", "url", "none", or "user-preference"',
    };
  }

  if (!VALID_PERSISTENCE.has(spec.persistence)) {
    return {
      pass: false,
      code: 'USS006',
      message: `persistence="${spec.persistence}" is invalid — must be "session", "url", "none", or "user-preference"`,
    };
  }

  return {
    pass: true,
    code: 'USS006',
    message: `filter-persistence: persistence="${spec.persistence}"`,
  };
}
