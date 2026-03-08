/**
 * Gate URT005 — text-alignment
 * Every element with type="text" and textAlign="left" must also declare:
 * - rtlTextAlign: "right" or "start"
 * Hard-coded text-align:left breaks RTL text flow.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_RTL_TEXT_ALIGNS = new Set(['right', 'start']);

export async function run({ dir }) {
  const specPath = join(dir, 'rtl-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URT005',
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
      code: 'URT005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.elements)) {
    return {
      pass: true,
      code: 'URT005',
      message: 'No elements array — skipped',
      skipped: true,
    };
  }

  const leftAlignedTextElements = spec.elements.filter(
    el => el.type === 'text' && el.textAlign === 'left'
  );

  if (leftAlignedTextElements.length === 0) {
    return {
      pass: true,
      code: 'URT005',
      message: 'text-alignment: no left-aligned text elements — gate not applicable',
    };
  }

  const violations = [];
  leftAlignedTextElements.forEach(el => {
    const id = el.id || 'unknown';
    if (typeof el.rtlTextAlign !== 'string') {
      violations.push(
        `Text element "${id}" (textAlign=left) missing rtlTextAlign — must be "right" or "start"`
      );
    } else if (!VALID_RTL_TEXT_ALIGNS.has(el.rtlTextAlign)) {
      violations.push(
        `Text element "${id}" rtlTextAlign="${el.rtlTextAlign}" is invalid — must be "right" or "start"`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URT005',
      message: `${violations.length} left-aligned text element(s) missing rtlTextAlign override`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URT005',
    message: `text-alignment: all ${leftAlignedTextElements.length} left-aligned text element(s) have rtlTextAlign override`,
  };
}
