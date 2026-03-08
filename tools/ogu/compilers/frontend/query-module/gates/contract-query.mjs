import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'typed-return',
    description: 'useQuery must have typed generic: useQuery<ResponseType>',
    test: (content) => /useQuery\s*<\w/.test(content) || /useQuery\s*<\[/.test(content)
  },
  {
    id: 'stale-time',
    description: 'staleTime must be set (not left to default 0)',
    test: (content) => /staleTime\s*:/.test(content)
  },
  {
    id: 'error-typed',
    description: 'Error type must be specified (useQuery<Data, Error>)',
    test: (content) => /useQuery\s*<[^>]+,\s*\w/.test(content)
  },
  {
    id: 'no-direct-fetch',
    description: 'queryFn must call a typed fetcher, not raw fetch()',
    test: (content) => {
      // Allow fetch inside a dedicated fetcher fn defined outside the hook, but not raw fetch in queryFn
      const queryFnMatch = content.match(/queryFn\s*:\s*(?:async\s*)?\(?.*?\)?\s*=>\s*\{([\s\S]*?)\}/);
      if (!queryFnMatch) return true; // Can't analyze, pass
      return !/\bfetch\s*\(/.test(queryFnMatch[1]);
    }
  },
  {
    id: 'select-memoized',
    description: 'If select is used, it must be memoized with useCallback or defined outside',
    test: (content) => {
      if (!/\bselect\s*:/.test(content)) return true; // select not used
      return /useCallback/.test(content) || !/select\s*:\s*\(/.test(content); // inline arrow = violation
    }
  }
];

export async function run({ dir }) {
  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
  if (!hookFiles.length) {
    return { pass: false, code: 'QM012', message: 'No hook file found for contract check' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');
  const violations = CONTRACT_RULES.filter(rule => !rule.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'QM012',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'QM012', message: 'All contract rules passed' };
}
