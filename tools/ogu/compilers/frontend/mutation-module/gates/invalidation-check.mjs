import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'mutation-spec.json'), 'utf8'));

  // DELETE mutations without invalidation are a bigger problem; skip check for fire-and-forget
  if (spec.noInvalidation === true) {
    return { pass: true, code: 'MU005', message: 'noInvalidation flag set — skipping cache invalidation check', skipped: true };
  }

  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
  if (!hookFiles.length) {
    return { pass: false, code: 'MU005', message: 'No hook file found' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');

  const hasInvalidation = /queryClient\.invalidateQueries/.test(content) ||
                          /queryClient\.setQueryData/.test(content) || // optimistic update is also ok
                          /invalidateQueries/.test(content);

  if (!hasInvalidation) {
    return {
      pass: false, code: 'MU005',
      message: 'No queryClient.invalidateQueries in onSuccess — after a mutation, related queries must be invalidated',
      detail: 'Add: onSuccess: () => queryClient.invalidateQueries({ queryKey: entityQueryKeys.all })'
    };
  }

  // Check it's inside onSuccess (not just hanging around)
  const onSuccessMatch = content.match(/onSuccess\s*:[\s\S]*?(?=onError|onSettled|}\s*\))/);
  if (onSuccessMatch && !/invalidateQueries|setQueryData/.test(onSuccessMatch[0])) {
    return {
      pass: false, code: 'MU005',
      message: 'invalidateQueries found but not inside onSuccess callback',
      detail: 'Move invalidateQueries into onSuccess to ensure cache is only updated after confirmed server write'
    };
  }

  return { pass: true, code: 'MU005', message: 'Cache invalidation present in onSuccess' };
}
