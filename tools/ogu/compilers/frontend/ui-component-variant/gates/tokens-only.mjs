import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UCV002 — tokens-only: all variant color/visual values reference design token names.
 * Token references look like: "{color.interactive.primary}" or "{spacing.4}"
 * Non-token values (raw hex, keywords) trigger a violation.
 */
const TOKEN_REF = /^\{.+\}$/;
const CSS_KEYWORD_OK = new Set(['transparent', 'currentColor', 'inherit', 'none', 'auto', 'initial', 'unset']);

function isAllowedValue(value) {
  if (value === undefined || value === null) return true;
  const str = String(value).trim();
  if (TOKEN_REF.test(str)) return true;
  if (CSS_KEYWORD_OK.has(str)) return true;
  // Numbers without units are acceptable for non-color properties (e.g. opacity: 0, z-index: 10)
  if (/^-?[\d.]+$/.test(str)) return true;
  return false;
}

function collectVisualValues(variant) {
  const found = [];
  if (!variant.visual || typeof variant.visual !== 'object') return found;

  for (const [mode, modeProps] of Object.entries(variant.visual)) {
    if (typeof modeProps !== 'object' || modeProps === null) continue;
    for (const [prop, value] of Object.entries(modeProps)) {
      found.push({ path: `${variant.id}.visual.${mode}.${prop}`, value });
    }
  }
  return found;
}

export async function run({ dir }) {
  const specPath = join(dir, 'component-variant-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCV002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCV002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.variants) || spec.variants.length === 0) {
    return { pass: true, code: 'UCV002', message: 'No variants — gate skipped', skipped: true };
  }

  const violations = [];

  for (const variant of spec.variants) {
    const values = collectVisualValues(variant);
    for (const { path, value } of values) {
      if (!isAllowedValue(value)) {
        violations.push(`${path}: "${String(value).slice(0, 40)}" is not a token reference`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCV002',
      message: `${violations.length} visual property value(s) are not token references`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UCV002', message: `All visual properties use token references` };
}
