/**
 * Gate URT001 — spec-valid
 * rtl-spec.json must exist with:
 * - locales (array of locale strings that need RTL, e.g. ["ar","he","fa"])
 * - elements (array) — each with id, type, currentDirection("ltr"|"rtl"|"auto")
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_DIRECTIONS = new Set(['ltr', 'rtl', 'auto']);

export async function run({ dir }) {
  const specPath = join(dir, 'rtl-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URT001',
      message: 'rtl-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'URT001',
      message: `rtl-spec.json parse error: ${err.message}`,
    };
  }

  const violations = [];

  if (!Array.isArray(spec.locales) || spec.locales.length === 0) {
    violations.push('locales (array) is missing or empty — must include at least one RTL locale (e.g. "ar", "he", "fa")');
  } else {
    spec.locales.forEach((locale, i) => {
      if (typeof locale !== 'string' || locale.trim() === '') {
        violations.push(`locales[${i}] is not a valid locale string`);
      }
    });
  }

  if (!Array.isArray(spec.elements) || spec.elements.length === 0) {
    violations.push('elements (array) is missing or empty');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URT001',
      message: `rtl-spec.json missing required top-level fields: ${violations.join('; ')}`,
    };
  }

  const elementViolations = [];
  spec.elements.forEach((el, i) => {
    if (typeof el.id !== 'string' || el.id.trim() === '') {
      elementViolations.push(`elements[${i}] missing id (string)`);
    }
    if (typeof el.type !== 'string' || el.type.trim() === '') {
      elementViolations.push(`elements[${i}] missing type (string)`);
    }
    if (typeof el.currentDirection !== 'string') {
      elementViolations.push(`elements[${i}] missing currentDirection — must be "ltr", "rtl", or "auto"`);
    } else if (!VALID_DIRECTIONS.has(el.currentDirection)) {
      elementViolations.push(
        `elements[${i}] currentDirection="${el.currentDirection}" is invalid — must be "ltr", "rtl", or "auto"`
      );
    }
  });

  if (elementViolations.length > 0) {
    return {
      pass: false,
      code: 'URT001',
      message: `${elementViolations.length} element(s) missing required fields`,
      detail: elementViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URT001',
    message: `spec-valid: ${spec.locales.length} RTL locale(s), ${spec.elements.length} element(s)`,
  };
}
