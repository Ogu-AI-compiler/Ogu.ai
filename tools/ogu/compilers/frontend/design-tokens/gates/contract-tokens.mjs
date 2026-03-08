import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'tailwind-extended',
    description: 'tailwind.config.ts must extend (not replace) the default theme',
    test: (content) => /theme\s*:\s*\{\s*extend/.test(content) && !/theme\s*:\s*\{(?!\s*extend)/.test(content)
  },
  {
    id: 'css-vars-defined',
    description: 'Colors should be expressed as CSS custom properties for runtime theming',
    test: (content) => /--\w+(-\w+)*\s*:/.test(content) || /var\s*\(--/.test(content)
  },
  {
    id: 'no-hardcoded-colors-in-config',
    description: 'tailwind.config should reference CSS vars, not hardcoded hex',
    test: (content) => {
      // Allow a few hardcoded values but warn if excessive
      const hexMatches = (content.match(/#[0-9a-fA-F]{3,8}/g) || []).length;
      return hexMatches < 10; // allow some; excessive = violation
    }
  },
  {
    id: 'semantic-layer',
    description: 'Semantic tokens (primary, secondary, destructive, muted) must be defined separate from raw palette',
    test: (content) => /primary|secondary|destructive|muted|accent/.test(content)
  }
];

export async function run({ dir }) {
  const configFiles = readdirSync(dir).filter(f =>
    f.includes('tailwind') || f.includes('tokens') || f.includes('theme')
  ).filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.css'));

  if (!configFiles.length) {
    return { pass: false, code: 'DT008', message: 'No tailwind.config or tokens file found' };
  }

  const content = configFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(rule => !rule.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'DT008',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'DT008', message: 'All token contract rules passed' };
}
