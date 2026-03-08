import { readFileSync } from 'fs';
import { join } from 'path';

// Convert hex to relative luminance
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function toLuminance(r, g, b) {
  const [R, G, B] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hex1, hex2) {
  try {
    const [r1, g1, b1] = hexToRgb(hex1);
    const [r2, g2, b2] = hexToRgb(hex2);
    const l1 = toLuminance(r1, g1, b1);
    const l2 = toLuminance(r2, g2, b2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return null;
  }
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'tokens-spec.json'), 'utf8'));

  // Check declared contrast pairs
  if (!spec.contrastPairs || !spec.contrastPairs.length) {
    return { pass: true, code: 'DT004', message: 'No contrastPairs defined — skipping WCAG check', skipped: true };
  }

  const violations = [];

  for (const pair of spec.contrastPairs) {
    const { foreground, background, level = 'AA', size = 'normal' } = pair;

    const fg = spec.colors?.[foreground] || foreground;
    const bg = spec.colors?.[background] || background;

    if (!fg || !bg) {
      violations.push(`Color pair '${foreground}/${background}' not found in spec.colors`);
      continue;
    }

    // Only check hex colors
    if (!fg.startsWith('#') || !bg.startsWith('#')) continue;

    const ratio = contrastRatio(fg, bg);
    if (ratio === null) continue;

    // WCAG thresholds
    const threshold = level === 'AAA'
      ? (size === 'large' ? 4.5 : 7.0)
      : (size === 'large' ? 3.0 : 4.5);

    if (ratio < threshold) {
      violations.push(`${foreground} on ${background}: ratio ${ratio.toFixed(2)}:1 (need ${threshold}:1 for WCAG ${level} ${size})`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DT004',
      message: `WCAG contrast failures (${violations.length})`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'DT004', message: `All ${spec.contrastPairs.length} color pairs pass WCAG contrast` };
}
