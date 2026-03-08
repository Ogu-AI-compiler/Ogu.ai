import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'typed-signature',
    description: 'Function must have fully typed parameters and return type — no implicit any',
    test: (content, spec) => {
      const fnPattern = new RegExp(`(function|const)\\s+${spec.name}[^:]*:\\s*\\w+`);
      return fnPattern.test(content);
    }
  },
  {
    id: 'jsdoc-present',
    description: 'Function should have JSDoc comment describing purpose, params, and return',
    test: (content, spec) => /\/\*\*[\s\S]*?\*\//.test(content)
  },
  {
    id: 'pure-function',
    description: 'Function must be deterministic — same input always returns same output',
    test: (content) => !/Math\.random|Date\.now|new Date\(\)/.test(content)
  },
  {
    id: 'no-mutation',
    description: 'Function must not mutate input arguments — clone if transformation is needed',
    test: (content) => {
      // Heuristic: check for direct array/object mutation patterns on params
      return !/\.push\(|\.splice\(|\.sort\(\)|\.reverse\(/.test(content) ||
             /\.\.\.|structuredClone|JSON\.parse.*JSON\.stringify|slice\(\)/.test(content);
    }
  }
];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'utility-spec.json'), 'utf8'));
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'UF010', message: 'No utility file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(r => !r.test(content, spec));

  if (violations.length) {
    return {
      pass: false, code: 'UF010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'UF010', message: 'All utility contract rules passed' };
}
