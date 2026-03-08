import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'animation-spec.json'), 'utf8'));

  // Check spec-level reduced motion declaration
  if (spec.reducedMotion) {
    // Spec explicitly declares reduced-motion variant — check it exists
    const hasNone = spec.variants.reducedMotion || spec.variants['reduced-motion'] ||
                    spec.reducedMotion === 'none' || spec.reducedMotion === 'opacity-only';
    if (!hasNone) {
      return { pass: false, code: 'AN005', message: 'spec.reducedMotion declared but no corresponding variant or value defined' };
    }
  }

  // Check implementation files
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.css'));
  if (!files.length) {
    return { pass: true, code: 'AN005', message: 'No implementation files yet — reduced-motion check deferred', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check for any reduced-motion handling
  const hasReducedMotion =
    /prefers-reduced-motion/.test(content) ||
    /motion-reduce:/.test(content) ||         // Tailwind prefix
    /useReducedMotion/.test(content) ||        // Framer hook
    /reducedMotion/.test(content);             // Framer AnimatePresence prop

  if (!hasReducedMotion) {
    return {
      pass: false, code: 'AN005',
      message: 'No reduced-motion fallback found in animation implementation',
      detail: [
        'Option 1 (Framer): const prefersReduced = useReducedMotion(); const variants = prefersReduced ? staticVariants : animatedVariants',
        'Option 2 (CSS): @media (prefers-reduced-motion: reduce) { .animated { animation: none; transition: none; } }',
        'Option 3 (Tailwind): className="motion-reduce:transition-none motion-reduce:animate-none"'
      ].join('\n')
    };
  }

  return { pass: true, code: 'AN005', message: 'Reduced-motion fallback present' };
}
