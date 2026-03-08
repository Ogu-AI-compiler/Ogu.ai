/**
 * Gate USS005 — partial-results
 * Spec must declare loadingState object with:
 * - type: "skeleton" | "spinner" | "progressive"
 * Escape hatch: spec.loadingHandledGlobally = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_LOADING_TYPES = new Set(['skeleton', 'spinner', 'progressive']);

export async function run({ dir }) {
  const specPath = join(dir, 'search-filter-sort-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'USS005',
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
      code: 'USS005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (spec.loadingHandledGlobally === true) {
    return {
      pass: true,
      code: 'USS005',
      message: 'partial-results: loadingHandledGlobally:true — gate not applicable',
      skipped: true,
    };
  }

  if (typeof spec.loadingState !== 'object' || spec.loadingState === null || Array.isArray(spec.loadingState)) {
    return {
      pass: false,
      code: 'USS005',
      message: 'loadingState is missing — declare it or set loadingHandledGlobally:true',
    };
  }

  const ls = spec.loadingState;
  const violations = [];

  if (typeof ls.type !== 'string') {
    violations.push('loadingState.type is missing — must be "skeleton", "spinner", or "progressive"');
  } else if (!VALID_LOADING_TYPES.has(ls.type)) {
    violations.push(
      `loadingState.type="${ls.type}" is invalid — must be "skeleton", "spinner", or "progressive"`
    );
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS005',
      message: `loadingState is invalid: ${violations.length} issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USS005',
    message: `partial-results: loadingState.type="${ls.type}"`,
  };
}
