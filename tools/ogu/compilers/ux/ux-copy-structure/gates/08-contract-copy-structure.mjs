/**
 * Gate UCS008 — contract-copy-structure
 * Final contract check:
 * - version declared
 * - feature_id or id declared
 * - each slot has a screen reference
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS008',
      message: 'copy-structure-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UCS008',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.content_slots)) {
    return {
      pass: true,
      code: 'UCS008',
      message: 'No content_slots array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Rule: version declared
  if (!spec.version) {
    violations.push('Contract: copy-structure-spec.json missing field "version"');
  }

  // Rule: feature_id or id declared for cross-compiler referencing
  const hasFeatureId =
    typeof spec.feature_id === 'string' && spec.feature_id.trim() !== '';
  const hasId =
    typeof spec.id === 'string' && spec.id.trim() !== '';

  if (!hasFeatureId && !hasId) {
    violations.push(
      'Contract: copy-structure-spec.json missing identifier field (feature_id or id)'
    );
  }

  // Rule: each slot has a screen reference
  spec.content_slots.forEach((slot, i) => {
    if (typeof slot.screen !== 'string' || slot.screen.trim() === '') {
      violations.push(
        `Contract: content_slots[${i}](id="${slot.id ?? 'unknown'}") missing or empty field: screen`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS008',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS008',
    message: 'contract-copy-structure: all contract rules satisfied',
  };
}
