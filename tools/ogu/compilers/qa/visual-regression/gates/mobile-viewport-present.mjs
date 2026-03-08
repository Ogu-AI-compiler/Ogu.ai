import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA062 — mobile-viewport-present
 * At least one mobile viewport (width ≤ 768px) must be declared.
 *
 * Visual regressions are not uniform across screen sizes:
 *   - Flexbox wrapping can collapse at breakpoints
 *   - Navigation menus collapse to hamburger menus (completely different structure)
 *   - Font sizes, spacing, and touch targets differ
 *   - Images switch to mobile-optimized variants
 *
 * A visual regression suite that only tests desktop misses entire categories
 * of mobile-specific layout bugs. With over 60% of web traffic being mobile,
 * mobile viewport coverage is not optional.
 *
 * Mobile threshold: width ≤ 768px
 */

const MOBILE_MAX_WIDTH = 768;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'visual-regression-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA062', message: 'visual-regression-spec.json not readable' }; }

  const viewports = spec.viewports ?? [];
  const mobileViewports = viewports.filter(vp => typeof vp.width === 'number' && vp.width <= MOBILE_MAX_WIDTH);

  if (mobileViewports.length === 0) {
    const declared = viewports.map(vp => `${vp.name ?? 'unnamed'} (${vp.width}px)`).join(', ');
    return {
      pass: false, code: 'QA062',
      message: 'No mobile viewport (width ≤ 768px) declared',
      detail: `Declared viewports: ${declared || 'none'}\nAdd a mobile viewport:\n  { "name": "mobile", "width": 375, "height": 812 }`,
    };
  }

  const desktopViewports = viewports.filter(vp => typeof vp.width === 'number' && vp.width > MOBILE_MAX_WIDTH);
  const both = mobileViewports.length > 0 && desktopViewports.length > 0;
  const coverage = both ? 'mobile + desktop' : 'mobile only';

  return {
    pass: true, code: 'QA062',
    message: `${mobileViewports.length} mobile viewport(s) declared — ${coverage} (${viewports.length} total)`,
  };
}
