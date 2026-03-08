import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCS004 — focus-contrast: focus indicator color has contrast ≥ 3:1 against adjacent surface */

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const bigint = parseInt(full, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb) {
  return 0.2126 * toLinear(rgb.r)
       + 0.7152 * toLinear(rgb.g)
       + 0.0722 * toLinear(rgb.b);
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isHex(value) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

export async function run({ dir }) {
  const specPath = join(dir, 'color-system-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCS004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCS004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // Focus info lives in spec.focusIndicator: { color: "#hex", adjacentSurface: "#hex" }
  if (!spec.focusIndicator) {
    return {
      pass: false,
      code: 'UCS004',
      message: 'focusIndicator not declared in color-system-spec.json',
      detail: 'Add: { "focusIndicator": { "color": "#hex", "adjacentSurface": "#hex" } }',
    };
  }

  const { color, adjacentSurface } = spec.focusIndicator;

  if (!color || !adjacentSurface) {
    return {
      pass: false,
      code: 'UCS004',
      message: 'focusIndicator missing "color" or "adjacentSurface" field',
    };
  }

  // If either is a token reference, we cannot compute — skip
  if (!isHex(color) || !isHex(adjacentSurface)) {
    return {
      pass: true,
      code: 'UCS004',
      message: 'Focus colors are token references — contrast check skipped (resolve tokens first)',
      skipped: true,
    };
  }

  const MIN_RATIO = 3.0;
  const ratio = contrastRatio(color, adjacentSurface);

  if (ratio < MIN_RATIO) {
    return {
      pass: false,
      code: 'UCS004',
      message: `Focus indicator contrast ${ratio.toFixed(2)}:1 < required 3:1 (WCAG 2.1 SC 1.4.11)`,
      detail: `Focus color: ${color}, Surface: ${adjacentSurface}`,
    };
  }

  return {
    pass: true,
    code: 'UCS004',
    message: `Focus indicator contrast ${ratio.toFixed(2)}:1 ≥ 3:1 (WCAG 2.1 SC 1.4.11)`,
  };
}
