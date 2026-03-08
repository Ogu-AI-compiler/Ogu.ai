import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'SW007', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  // Must destructure { data, error, isLoading } or equivalent
  const hasDataDestructure = /\{\s*data[\s\S]{0,50}\}\s*=\s*useSWR/.test(content);
  const hasErrorDestructure = /\{\s*[^}]*error[^}]*\}\s*=\s*useSWR/.test(content);
  if (!hasDataDestructure) return { pass: false, code: 'SW007', message: 'useSWR result not destructured — must extract { data, error, isLoading }', detail: 'const { data, error, isLoading } = useSWR(key, fetcher)' };
  if (!hasErrorDestructure) return { pass: false, code: 'SW007', message: 'Error state not destructured from useSWR — must handle error', detail: 'Always destructure { error } to handle failed fetches' };
  return { pass: true, code: 'SW007', message: 'SWR state shape properly destructured' };
}
