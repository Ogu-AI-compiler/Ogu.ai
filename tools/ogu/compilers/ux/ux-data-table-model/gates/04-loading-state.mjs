/**
 * Gate UDT004 — loading-state
 * Spec must declare loadingState: "skeleton" | "spinner" | "overlay"
 * Every interactive table must show a loading state during data fetch.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_LOADING_STATES = new Set(['skeleton', 'spinner', 'overlay']);

export async function run({ dir }) {
  const specPath = join(dir, 'data-table-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDT004',
      message: 'data-table-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UDT004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.loadingState !== 'string') {
    return {
      pass: false,
      code: 'UDT004',
      message: 'loadingState is missing — must be "skeleton", "spinner", or "overlay"',
    };
  }

  if (!VALID_LOADING_STATES.has(spec.loadingState)) {
    return {
      pass: false,
      code: 'UDT004',
      message: `loadingState="${spec.loadingState}" is invalid — must be "skeleton", "spinner", or "overlay"`,
    };
  }

  return {
    pass: true,
    code: 'UDT004',
    message: `loading-state: loadingState="${spec.loadingState}"`,
  };
}
