import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TAILWIND_BREAKPOINTS = ['sm:', 'md:', 'lg:', 'xl:', '2xl:'];
const CSS_BREAKPOINTS = ['@media', 'min-width', 'max-width'];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'layout-spec.json'), 'utf8'));

  // If spec explicitly opts out
  if (spec.responsive === false) {
    return { pass: true, code: 'LC005', message: 'responsive: false in spec — breakpoint check skipped', skipped: true };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css'));
  if (!files.length) return { pass: false, code: 'LC005', message: 'No layout files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasTailwindBreakpoints = TAILWIND_BREAKPOINTS.some(bp => content.includes(bp));
  const hasCSSBreakpoints = CSS_BREAKPOINTS.some(bp => content.includes(bp));

  if (!hasTailwindBreakpoints && !hasCSSBreakpoints) {
    return {
      pass: false, code: 'LC005',
      message: 'No responsive breakpoints found — layout must adapt across screen sizes',
      detail: 'Add Tailwind breakpoints: className="flex-col md:flex-row" or CSS @media queries'
    };
  }

  // Check sidebar is hidden on mobile if present
  if (spec.slots.includes('sidebar')) {
    const sidebarHiddenMobile = /hidden.*md:|sm:hidden|md:flex.*sidebar|md:block.*sidebar/.test(content);
    if (!sidebarHiddenMobile) {
      return {
        pass: false, code: 'LC005',
        message: 'Layout has sidebar but no mobile visibility control',
        detail: 'Add: className="hidden md:flex" on sidebar or implement drawer for mobile'
      };
    }
  }

  return { pass: true, code: 'LC005', message: 'Responsive breakpoints present' };
}
