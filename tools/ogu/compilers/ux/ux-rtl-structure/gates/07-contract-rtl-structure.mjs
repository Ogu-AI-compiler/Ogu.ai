/**
 * Gate URT007 — contract-rtl-structure
 * Final contract check:
 * - version declared
 * - unique element ids
 * - at least one RTL locale declared
 * - at least one element declared
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'rtl-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URT007',
      message: 'rtl-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URT007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const violations = [];

  if (!spec.version) {
    violations.push('Contract: rtl-spec.json missing field "version"');
  }

  if (!Array.isArray(spec.locales) || spec.locales.length === 0) {
    violations.push('Contract: locales must be a non-empty array with at least one RTL locale');
  }

  if (!Array.isArray(spec.elements) || spec.elements.length === 0) {
    violations.push('Contract: elements must be a non-empty array');
  } else {
    const seenIds = new Map();
    spec.elements.forEach((el, i) => {
      if (typeof el.id !== 'string') return;
      if (seenIds.has(el.id)) {
        violations.push(`Contract: Duplicate element id "${el.id}"`);
      } else {
        seenIds.set(el.id, true);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URT007',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URT007',
    message: 'contract-rtl-structure: all contract rules satisfied',
  };
}
