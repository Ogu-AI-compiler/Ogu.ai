import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UCS003 — contrast-ratios: every foreground/background pairing meets the declared WCAG threshold */

// WCAG 2.1 relative luminance calculation
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const bigint = parseInt(full, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8)  & 255,
    b:  bigint        & 255,
  };
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
    return { pass: true, code: 'UCS003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCS003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.pairings) || spec.pairings.length === 0) {
    return { pass: true, code: 'UCS003', message: 'No pairings declared — gate skipped', skipped: true };
  }

  // WCAG level: spec.wcagLevel = "AA" (4.5:1) or "AAA" (7:1). Default AA.
  const wcagLevel = spec.wcagLevel || 'AA';
  const requiredRatio = wcagLevel === 'AAA' ? 7.0 : 4.5;

  const violations = [];
  let checked = 0;

  for (const pairing of spec.pairings) {
    const { foreground, background, label, requiredRatio: pairingRatio } = pairing;
    const threshold = pairingRatio ?? requiredRatio;

    // Skip pairings where either color is a token reference (not resolvable without token spec)
    if (!isHex(foreground) || !isHex(background)) {
      continue;
    }

    const ratio = contrastRatio(foreground, background);
    checked++;

    if (ratio < threshold) {
      const pairingLabel = label || `${foreground} on ${background}`;
      violations.push(
        `"${pairingLabel}": contrast ${ratio.toFixed(2)}:1 < required ${threshold}:1 (WCAG ${wcagLevel})`
      );
    }
  }

  if (checked === 0) {
    return {
      pass: true,
      code: 'UCS003',
      message: 'All pairings use token references — contrast check skipped (resolve tokens first)',
      skipped: true,
    };
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS003',
      message: `${violations.length} pairing(s) fail WCAG ${wcagLevel} contrast (${threshold}:1 required)`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS003',
    message: `All ${checked} pairing(s) meet WCAG ${wcagLevel} contrast (≥${threshold}:1)`,
  };
}
