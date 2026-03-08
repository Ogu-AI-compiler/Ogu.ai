import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
  if (!hookFiles.length) {
    return { pass: false, code: 'MU006', message: 'No hook file found' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');

  // Check if optimistic update pattern is used
  const hasOptimistic = /onMutate\s*:/.test(content);

  if (!hasOptimistic) {
    // No optimistic update — that's fine, just skip
    return { pass: true, code: 'MU006', message: 'No optimistic update — skipping rollback check', skipped: true };
  }

  // If onMutate is defined, onError must restore previous state via context
  const hasOnError = /onError\s*:.*context/.test(content) ||
                     /onError\s*:\s*\([^)]*context/.test(content) ||
                     // Check for context parameter in onError
                     (content.includes('onMutate') && content.match(/onError\s*:\s*\([^)]*,[^)]*,[^)]*context/));

  const hasSetQueryData = /queryClient\.setQueryData.*context/.test(content);

  if (!hasOnError || !hasSetQueryData) {
    return {
      pass: false, code: 'MU006',
      message: 'Optimistic update (onMutate) present but onError rollback missing',
      detail: [
        'When using onMutate for optimistic updates, you MUST implement rollback:',
        'onMutate: async (newData) => {',
        '  await queryClient.cancelQueries(...)',
        '  const previous = queryClient.getQueryData(...)',
        '  queryClient.setQueryData(..., newData)',
        '  return { previous }  // <-- context',
        '},',
        'onError: (err, vars, context) => {',
        '  queryClient.setQueryData(..., context.previous)  // <-- rollback',
        '}'
      ].join('\n')
    };
  }

  return { pass: true, code: 'MU006', message: 'Optimistic update has rollback in onError' };
}
