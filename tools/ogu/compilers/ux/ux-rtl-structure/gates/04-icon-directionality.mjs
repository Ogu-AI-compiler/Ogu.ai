/**
 * Gate URT004 — icon-directionality
 * Every element with type="icon" and directional:true must declare:
 * - rtlVariant (string — the RTL icon name or "mirror" to flip CSS)
 * Directional icons without RTL variants show wrong arrow directions in RTL.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'rtl-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URT004',
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
      code: 'URT004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.elements)) {
    return {
      pass: true,
      code: 'URT004',
      message: 'No elements array — skipped',
      skipped: true,
    };
  }

  const directionalIcons = spec.elements.filter(
    el => el.type === 'icon' && el.directional === true
  );

  if (directionalIcons.length === 0) {
    return {
      pass: true,
      code: 'URT004',
      message: 'icon-directionality: no directional icon elements — gate not applicable',
    };
  }

  const violations = [];
  directionalIcons.forEach(el => {
    const id = el.id || 'unknown';
    if (typeof el.rtlVariant !== 'string' || el.rtlVariant.trim() === '') {
      violations.push(
        `Icon element "${id}" (directional:true) missing rtlVariant — declare the RTL icon name or "mirror"`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URT004',
      message: `${violations.length} directional icon element(s) missing rtlVariant`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URT004',
    message: `icon-directionality: all ${directionalIcons.length} directional icon(s) have rtlVariant declared`,
  };
}
