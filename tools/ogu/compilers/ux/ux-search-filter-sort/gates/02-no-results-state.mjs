/**
 * Gate USS002 — no-results-state
 * Spec must declare noResultsState with:
 * - message (string)
 * - at least one of: clearFiltersAction (boolean) or suggestionsEnabled (boolean)
 * Escape hatch: spec.noResultsHandledGlobally = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'search-filter-sort-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'USS002',
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
      code: 'USS002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (spec.noResultsHandledGlobally === true) {
    return {
      pass: true,
      code: 'USS002',
      message: 'no-results-state: noResultsHandledGlobally:true — gate not applicable',
      skipped: true,
    };
  }

  const violations = [];

  if (typeof spec.noResultsState !== 'object' || spec.noResultsState === null || Array.isArray(spec.noResultsState)) {
    return {
      pass: false,
      code: 'USS002',
      message: 'noResultsState is missing — declare it or set noResultsHandledGlobally:true',
    };
  }

  const nrs = spec.noResultsState;

  if (typeof nrs.message !== 'string' || nrs.message.trim() === '') {
    violations.push('noResultsState.message (string) is missing or empty');
  }

  const hasAction = nrs.clearFiltersAction === true || nrs.suggestionsEnabled === true;
  if (!hasAction) {
    violations.push(
      'noResultsState must declare at least one of: clearFiltersAction:true or suggestionsEnabled:true'
    );
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USS002',
      message: `noResultsState is invalid: ${violations.length} issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USS002',
    message: `no-results-state: message declared, clearFiltersAction=${!!nrs.clearFiltersAction}, suggestionsEnabled=${!!nrs.suggestionsEnabled}`,
  };
}
