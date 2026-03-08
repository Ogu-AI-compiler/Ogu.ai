import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'type-safe-keys',
    description: 'TypeScript key type must be generated from default locale (no string-indexed access)',
    test: (dir, spec) => {
      const tsFiles = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
      if (!tsFiles.length) return false;
      const content = tsFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
      return /type\s+TranslationKey|keyof\s+typeof|T extends\s+string/.test(content) ||
             /satisfies\s+Record/.test(content);
    }
  },
  {
    id: 'use-translation-hook',
    description: 'A useTranslation hook or t() accessor must be exported',
    test: (dir) => {
      const tsFiles = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
      if (!tsFiles.length) return true; // no impl yet
      const content = tsFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
      return /export.*useTranslation|export.*\bt\b\s*=/.test(content);
    }
  },
  {
    id: 'rtl-support',
    description: "If RTL locales (ar, he, fa) are included, dir='rtl' attribute must be handled",
    test: (dir, spec) => {
      const rtlLocales = ['ar', 'he', 'fa', 'ur'];
      const hasRTL = spec.locales.some(l => rtlLocales.includes(l));
      if (!hasRTL) return true; // not needed
      const tsFiles = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      const content = tsFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
      return /dir.*rtl|rtl.*dir/.test(content);
    }
  }
];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'i18n-spec.json'), 'utf8'));
  const violations = CONTRACT_RULES.filter(r => !r.test(dir, spec));

  if (violations.length) {
    return {
      pass: false, code: 'I1008',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'I1008', message: 'All i18n contract rules passed' };
}
