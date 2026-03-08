import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'aria-busy',
    description: 'Skeleton container must have aria-busy="true"',
    test: (content) => /aria-busy/.test(content)
  },
  {
    id: 'no-text-content',
    description: 'Skeleton must not contain readable text — only structural placeholders',
    test: (content) => {
      // Check there's no JSX text nodes (rough heuristic)
      const textNodePattern = />\s*[A-Z][a-zA-Z\s]{5,}\s*</;
      return !textNodePattern.test(content);
    }
  },
  {
    id: 'fixed-dimensions',
    description: 'Skeleton elements must have explicit width/height classes to match target layout',
    test: (content) => /h-\d|w-\d|h-\[|w-\[|height|width/.test(content)
  },
  {
    id: 'bg-muted',
    description: 'Skeleton fill must use muted/neutral colors (bg-muted, bg-gray, bg-slate)',
    test: (content) => /bg-muted|bg-gray|bg-slate|bg-neutral|bg-secondary|bg-accent|skeleton/.test(content)
  }
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx'));

  if (!files.length) {
    return { pass: false, code: 'SK011', message: 'No skeleton component file found' };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(rule => !rule.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'SK011',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'SK011', message: 'All skeleton contract rules passed' };
}
