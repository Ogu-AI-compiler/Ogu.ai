import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'RG006', message: 'No guard component file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasLoadingCheck = /isLoading|isPending|loading.*return|return.*loading/.test(content);
  const hasLoadingUI = /Spinner|Skeleton|Loading|CircularProgress|loader/.test(content);

  if (!hasLoadingCheck) {
    return { pass: false, code: 'RG006', message: 'No loading state — guard must handle auth pending state', detail: 'Add: if (isLoading) return <LoadingSpinner />' };
  }

  if (!hasLoadingUI) {
    return { pass: false, code: 'RG006', message: 'Loading check exists but renders nothing — add a spinner or skeleton', detail: 'if (isLoading) return <LoadingSpinner />' };
  }

  return { pass: true, code: 'RG006', message: 'Loading state handled with UI feedback' };
}
