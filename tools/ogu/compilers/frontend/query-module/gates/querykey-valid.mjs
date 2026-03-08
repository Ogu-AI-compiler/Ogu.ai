import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'query-spec.json'), 'utf8'));
  const params = [
    ...(spec.pathParams || []),
    ...(spec.queryParams || [])
  ];

  const hookFiles = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && f.startsWith('use'));
  if (!hookFiles.length) {
    return { pass: false, code: 'QM003', message: 'No hook file found' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');

  // Find queryKey array — match export const xxxKey = [...] or queryKey: [...] in useQuery call
  const queryKeyMatch = content.match(/queryKey\s*:\s*\[([^\]]*)\]/s) ||
                        content.match(/export\s+const\s+\w+[Kk]ey[s]?\s*=\s*\(.*?\)\s*=>\s*\[([^\]]*)\]/s) ||
                        content.match(/export\s+const\s+\w+[Kk]ey[s]?\s*=\s*\[([^\]]*)\]/s);

  if (!queryKeyMatch) {
    return { pass: false, code: 'QM003', message: 'queryKey array literal not found in hook' };
  }

  const keyContent = queryKeyMatch[1];

  // Every path/query param should appear in the queryKey
  const missing = params.filter(p => !keyContent.includes(p));
  if (missing.length) {
    return {
      pass: false, code: 'QM003',
      message: `Params not in queryKey: ${missing.join(', ')}. All params must be in queryKey for cache correctness.`,
      detail: `queryKey content: [${keyContent.trim()}]`
    };
  }

  return {
    pass: true, code: 'QM003',
    message: `queryKey is array and includes all params (${params.length || 0} params checked)`
  };
}
