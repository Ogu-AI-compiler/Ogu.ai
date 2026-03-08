import { readFileSync } from 'fs';
import { join } from 'path';

const FRAMER_PRESETS = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'circIn', 'circOut', 'circInOut',
  'backIn', 'backOut', 'backInOut', 'anticipate', 'spring', 'tween', 'inertia'];

function isValidCubicBezier(str) {
  return /^cubic-bezier\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\)$/.test(str) ||
         /^\[[\d.,\s]+\]$/.test(str); // Framer array form [x1, y1, x2, y2]
}

function checkEasing(ease) {
  if (!ease) return true;
  if (typeof ease === 'string') return FRAMER_PRESETS.includes(ease) || isValidCubicBezier(ease);
  if (Array.isArray(ease)) return ease.length === 4 && ease.every(v => typeof v === 'number');
  return false;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'animation-spec.json'), 'utf8'));
  const violations = [];

  for (const [name, variant] of Object.entries(spec.variants)) {
    if (variant.ease && !checkEasing(variant.ease)) {
      violations.push(`Variant '${name}': invalid easing '${variant.ease}' — use a preset (${FRAMER_PRESETS.slice(0, 4).join(', ')}...) or cubic-bezier()`);
    }
    if (variant.transition?.ease && !checkEasing(variant.transition.ease)) {
      violations.push(`Variant '${name}' transition: invalid easing '${variant.transition.ease}'`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'AN002', message: `Invalid easing curves (${violations.length})`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'AN002', message: 'All easing curves valid' };
}
