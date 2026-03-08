import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ZUSTAND_RULES = [
  {
    id: 'typed-state',
    description: 'Zustand store must define a typed state interface',
    test: (content) => /interface\s+\w*State\s*\{/.test(content) || /type\s+\w*State\s*=\s*\{/.test(content)
  },
  {
    id: 'devtools',
    description: 'Zustand store should use devtools middleware in development',
    test: (content) => /devtools/.test(content) || /process\.env\.NODE_ENV/.test(content)
  },
  {
    id: 'exported-selectors',
    description: 'Selectors must be exported for use in components',
    test: (content) => /export\s+const\s+(?:select|use)\w+/.test(content)
  }
];

const REDUX_RULES = [
  {
    id: 'slice-actions-exported',
    description: 'Slice actions must be exported for use in dispatches',
    test: (content) => /export\s+const\s+\{[^}]+\}\s*=.*\.actions/.test(content)
  },
  {
    id: 'reducer-exported',
    description: 'Default export must be the slice reducer for store composition',
    test: (content) => /export\s+default\s+\w+\.reducer/.test(content) || /export\s+default\s+\w+Reducer/.test(content)
  },
  {
    id: 'typed-initial-state',
    description: 'initialState must have explicit type annotation',
    test: (content) => /initialState\s*:\s*\w+State/.test(content) || /initialState\s+as\s+\w+State/.test(content)
  }
];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'store-spec.json'), 'utf8'));
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  if (!files.length) {
    return { pass: false, code: 'SS012', message: 'No store file found for contract check' };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const rules = spec.engine === 'zustand' ? ZUSTAND_RULES : REDUX_RULES;
  const violations = rules.filter(rule => !rule.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'SS012',
      message: `Contract violations (${spec.engine}): ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'SS012', message: `All ${spec.engine} contract rules passed` };
}
