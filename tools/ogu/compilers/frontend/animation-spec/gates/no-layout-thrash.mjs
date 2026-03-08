import { readFileSync } from 'fs';
import { join } from 'path';

// Properties that trigger layout recalculation — expensive and cause jank
const LAYOUT_PROPS = ['width', 'height', 'top', 'left', 'right', 'bottom',
  'margin', 'padding', 'borderWidth', 'fontSize', 'lineHeight'];

// GPU-accelerated safe alternatives
const SAFE_ALTERNATIVES = {
  width: 'scaleX', height: 'scaleY',
  top: 'y', left: 'x', right: 'x', bottom: 'y',
  opacity: 'opacity' // already safe
};

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'animation-spec.json'), 'utf8'));
  const violations = [];

  for (const [variantName, variant] of Object.entries(spec.variants)) {
    // Check the variant properties being animated
    const animatedProps = Object.keys(variant).filter(k => !['ease', 'transition', 'when', 'staggerChildren', 'delayChildren'].includes(k));

    for (const prop of animatedProps) {
      if (LAYOUT_PROPS.includes(prop)) {
        const alt = SAFE_ALTERNATIVES[prop] || 'transform/scale/translate';
        violations.push(`Variant '${variantName}': animating '${prop}' causes layout recalculation — use '${alt}' instead (GPU-accelerated)`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'AN006',
      message: `Layout-thrashing animations (${violations.length})`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'AN006', message: 'All animations use GPU-accelerated properties (transform, opacity)' };
}
