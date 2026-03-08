import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'typed-generics',
    description: 'useMutation must have typed generics: useMutation<ResponseType, ErrorType, VariablesType>',
    test: (content) => /useMutation\s*<\w/.test(content)
  },
  {
    id: 'on-error-handler',
    description: 'onError or typed error must be present',
    test: (content) => /onError\s*:/.test(content) || /useMutation\s*<[^>]+,[^>]+>/.test(content)
  },
  {
    id: 'invalidates-on-success',
    description: 'onSuccess must invalidate or update related queries',
    test: (content) => {
      if (!/onSuccess\s*:/.test(content)) return false;
      return /invalidateQueries|setQueryData/.test(content);
    }
  },
  {
    id: 'no-direct-state',
    description: 'Do not use useState inside useMutation callbacks — use query cache',
    test: (content) => {
      const onSuccessMatch = content.match(/onSuccess\s*:[\s\S]*?(?=onError|onSettled|\}\s*\))/);
      if (!onSuccessMatch) return true;
      return !/setState|dispatch\(/.test(onSuccessMatch[0]);
    }
  },
  {
    id: 'typed-variables',
    description: 'Mutation variables must be typed — use MutationFunction<Response, Variables>',
    test: (content) => /useMutation\s*<[^>]+,[^>]+,[^>]+>/.test(content) || /Variables|Payload|Input/.test(content)
  }
];

export async function run({ dir }) {
  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
  if (!hookFiles.length) {
    return { pass: false, code: 'MU013', message: 'No hook file found for contract check' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');
  const violations = CONTRACT_RULES.filter(rule => !rule.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'MU013',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'MU013', message: 'All contract rules passed' };
}
