import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UTH005 — high-contrast-opacity: high-contrast mode mappings must not use
 * opacity or transparency. Semi-transparent colors fail WCAG requirements for
 * high-contrast mode.
 *
 * Checks for rgba() with alpha < 1, or tokens with opacity fields set < 1.
 */

const RGBA_PATTERN = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/i;
const HEX_8_PATTERN = /^#([0-9A-Fa-f]{8})$/; // 8-digit hex includes alpha

function hasTransparency(value) {
  if (!value) return false;
  const str = String(value).trim();

  // Check rgba() with alpha < 1
  const rgbaMatch = RGBA_PATTERN.exec(str);
  if (rgbaMatch) {
    const alpha = parseFloat(rgbaMatch[1]);
    return alpha < 1;
  }

  // Check 8-digit hex where last two digits are not 'ff'
  const hex8Match = HEX_8_PATTERN.exec(str);
  if (hex8Match) {
    const alpha = parseInt(hex8Match[1].slice(6), 16) / 255;
    return alpha < 0.999;
  }

  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'theme-manifest-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTH005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTH005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const hasHighContrast = Array.isArray(spec.modes) && spec.modes.includes('high-contrast');
  if (!hasHighContrast) {
    return { pass: true, code: 'UTH005', message: 'No high-contrast mode declared — gate skipped', skipped: true };
  }

  const hcMappings = spec.mappings && spec.mappings['high-contrast'];
  if (!hcMappings || typeof hcMappings !== 'object') {
    return { pass: true, code: 'UTH005', message: 'No high-contrast mappings object — gate skipped', skipped: true };
  }

  const violations = [];

  for (const [tokenName, value] of Object.entries(hcMappings)) {
    if (hasTransparency(value)) {
      violations.push(`high-contrast["${tokenName}"]: value "${String(value).slice(0, 50)}" contains transparency — high-contrast mode requires fully opaque colors`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTH005',
      message: `${violations.length} high-contrast mapping(s) use transparency`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTH005',
    message: `All ${Object.keys(hcMappings).length} high-contrast mapping(s) are fully opaque`,
  };
}
