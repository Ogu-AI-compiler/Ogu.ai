import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const allFiles = readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css'));

  if (!allFiles.length) {
    return { pass: false, code: 'SK005', message: 'No component files found' };
  }

  const content = allFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check if shimmer/pulse animation is present
  const hasAnimation = /animate-pulse|animate-shimmer|shimmer|skeleton.*animation|@keyframes.*shimmer/.test(content);

  if (!hasAnimation) {
    // No animation at all — pass (static skeleton is fine)
    return { pass: true, code: 'SK005', message: 'No shimmer animation — reduced-motion check not needed', skipped: true };
  }

  // Check for reduced-motion handling
  const hasReducedMotion = /prefers-reduced-motion|motion-reduce|motion-safe/.test(content) ||
                            // Tailwind motion-reduce: prefix
                            /motion-reduce:animate-none|motion-reduce:hidden/.test(content);

  if (!hasReducedMotion) {
    return {
      pass: false, code: 'SK005',
      message: 'Shimmer animation present but no prefers-reduced-motion handling',
      detail: [
        'Add CSS: @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }',
        'Or Tailwind: className="animate-pulse motion-reduce:animate-none"'
      ].join('\n')
    };
  }

  return { pass: true, code: 'SK005', message: 'Shimmer animation respects prefers-reduced-motion' };
}
