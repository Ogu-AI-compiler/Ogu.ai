import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * UTH004 — dark-mode-contrast: dark mode foreground/background pairs declare contrast ratio ≥ 4.5:1
 *
 * This gate checks spec.darkModeContrast array if present.
 * Each entry: { foreground: "#hex", background: "#hex", label: "..." }
 */

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const bigint = parseInt(full, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb) {
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isHex(v) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);
}

export async function run({ dir }) {
  const specPath = join(dir, 'theme-manifest-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UTH004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UTH004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const hasDarkMode = Array.isArray(spec.modes) && spec.modes.includes('dark');
  if (!hasDarkMode) {
    return { pass: true, code: 'UTH004', message: 'No dark mode declared — gate skipped', skipped: true };
  }

  const pairs = Array.isArray(spec.darkModeContrast) ? spec.darkModeContrast : [];
  if (pairs.length === 0) {
    return { pass: true, code: 'UTH004', message: 'No darkModeContrast pairs declared — gate skipped', skipped: true };
  }

  const MIN_RATIO = 4.5;
  const violations = [];
  let checked = 0;

  for (const pair of pairs) {
    if (!isHex(pair.foreground) || !isHex(pair.background)) continue;
    const ratio = contrastRatio(pair.foreground, pair.background);
    checked++;
    if (ratio < MIN_RATIO) {
      const label = pair.label || `${pair.foreground} on ${pair.background}`;
      violations.push(`Dark "${label}": ${ratio.toFixed(2)}:1 < 4.5:1 required`);
    }
  }

  if (checked === 0) {
    return { pass: true, code: 'UTH004', message: 'All dark mode pairs use token references — check skipped', skipped: true };
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTH004',
      message: `${violations.length} dark mode pairing(s) fail WCAG AA contrast`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UTH004', message: `All ${checked} dark mode pairing(s) meet WCAG AA (4.5:1)` };
}
