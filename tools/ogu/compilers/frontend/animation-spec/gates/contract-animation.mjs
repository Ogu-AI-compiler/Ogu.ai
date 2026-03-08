import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'variants-exported',
    description: 'Animation variants object must be exported for use in components',
    test: (content) => /export\s+const\s+\w+Variants?\s*=/.test(content) || /export\s+\{.*[Vv]ariant/.test(content)
  },
  {
    id: 'reduced-motion-variant',
    description: 'A reducedMotion or static variant must be defined alongside animated variants',
    test: (content) => /reducedMotion|reduced.motion|prefers-reduced|useReducedMotion|motion-reduce/.test(content)
  },
  {
    id: 'no-inline-style-animation',
    description: 'Prefer variant-based animation over inline style objects with transitions',
    test: (content) => {
      const inlineAnims = (content.match(/style=\{\{.*transition.*\}\}/g) || []).length;
      return inlineAnims < 3;
    }
  },
  {
    id: 'transform-only',
    description: 'Animated properties should be transform-based (x, y, scale, rotate, opacity)',
    test: (content) => !/animate=\{\{.*(width|height|top|left|margin|padding)/.test(content)
  }
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts'));

  if (!files.length) {
    return { pass: true, code: 'AN011', message: 'No implementation files — contract check deferred', skipped: true };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'AN011',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'AN011', message: 'All animation contract rules passed' };
}
