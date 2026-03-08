/**
 * Gate UFF005 — draft-behavior
 * If spec.draftEnabled = true, spec must declare:
 * - draftSaveTrigger (string: "auto" | "manual")
 * - draftStorageKey (string)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_TRIGGERS = new Set(['auto', 'manual']);

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF005',
      message: 'form-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UFF005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  // Gate only applies when draftEnabled:true
  if (spec.draftEnabled !== true) {
    return {
      pass: true,
      code: 'UFF005',
      message: 'draft-behavior: draftEnabled not set — gate not applicable',
      skipped: true,
    };
  }

  const violations = [];

  if (typeof spec.draftSaveTrigger !== 'string' || !VALID_TRIGGERS.has(spec.draftSaveTrigger)) {
    violations.push(
      `draftSaveTrigger must be "auto" or "manual", got: ${JSON.stringify(spec.draftSaveTrigger)}`
    );
  }

  if (typeof spec.draftStorageKey !== 'string' || spec.draftStorageKey.trim() === '') {
    violations.push('draftStorageKey must be a non-empty string');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UFF005',
      message: 'draftEnabled:true but draft configuration incomplete',
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UFF005',
    message: `draft-behavior: draftSaveTrigger="${spec.draftSaveTrigger}", draftStorageKey="${spec.draftStorageKey}"`,
  };
}
