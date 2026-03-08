import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
  if (!hookFiles.length) {
    return { pass: false, code: 'MU007', message: 'No hook file found' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');

  // Check for onError handler
  const hasOnError = /onError\s*:/.test(content);

  // OR: the caller handles it (mutation.isError / mutation.error used in component)
  // This is harder to enforce statically — check if error types are at minimum exported
  const hasTypedError = /useMutation\s*<[^>]+,[^>]+>/.test(content) || // generic typed
                        /MutationError|ApiError|HttpError/.test(content);

  if (!hasOnError && !hasTypedError) {
    return {
      pass: false, code: 'MU007',
      message: 'No onError handler and no typed error generic — mutations must handle errors explicitly',
      detail: 'Add onError: (error: ApiError) => { toast.error(error.message) } or type the mutation: useMutation<Response, ApiError, Variables>'
    };
  }

  return { pass: true, code: 'MU007', message: hasOnError ? 'onError handler present' : 'Error type defined (caller handles)' };
}
