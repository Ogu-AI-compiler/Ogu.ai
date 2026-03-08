import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UCV006 — no-raw-values: no hardcoded hex, rgb(), rgba(), or raw px values
 * in variant visual properties.
 *
 * This gate is stricter than tokens-only — it explicitly catches the most
 * common raw value patterns that slip through code review.
 */

const RAW_VALUE_PATTERNS = [
  { pattern: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, label: 'hex color' },
  { pattern: /^rgb\(/i,  label: 'rgb() color' },
  { pattern: /^rgba\(/i, label: 'rgba() color' },
  { pattern: /^hsl\(/i,  label: 'hsl() color' },
  { pattern: /^hsla\(/i, label: 'hsla() color' },
  { pattern: /^\d+px$/,  label: 'raw px value' },
  { pattern: /^\d+rem$/, label: 'raw rem value' },
  { pattern: /^\d+em$/,  label: 'raw em value' },
];

const ESCAPE_HATCH = 'raw-value-ok';

function detectRawValue(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  for (const { pattern, label } of RAW_VALUE_PATTERNS) {
    if (pattern.test(str)) return label;
  }
  return null;
}

export async function run({ dir }) {
  const specPath = join(dir, 'component-variant-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCV006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCV006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const variants = Array.isArray(spec.variants) ? spec.variants : [];
  if (variants.length === 0) {
    return { pass: true, code: 'UCV006', message: 'No variants — gate skipped', skipped: true };
  }

  const violations = [];

  for (const variant of variants) {
    if (!variant.visual || typeof variant.visual !== 'object') continue;

    for (const [mode, modeProps] of Object.entries(variant.visual)) {
      if (typeof modeProps !== 'object' || modeProps === null) continue;

      for (const [prop, value] of Object.entries(modeProps)) {
        // Check for escape hatch annotation on the property
        const escapeKey = `${prop}__${ESCAPE_HATCH}`;
        if (modeProps[escapeKey] === true) continue;

        const rawType = detectRawValue(value);
        if (rawType) {
          violations.push(
            `Variant "${variant.id}".visual.${mode}.${prop}: ${rawType} "${String(value).slice(0, 40)}" — use a token reference`
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCV006',
      message: `${violations.length} raw value(s) found in variant visual properties`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UCV006', message: 'No raw values in variant visual properties' };
}
