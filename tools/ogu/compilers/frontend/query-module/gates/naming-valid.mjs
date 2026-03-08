import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  // Load spec
  const spec = JSON.parse(readFileSync(join(dir, 'query-spec.json'), 'utf8'));
  const hookName = spec.hookName;

  if (!hookName.startsWith('use')) {
    return { pass: false, code: 'QM002', message: `Hook name must start with 'use'. Got: ${hookName}` };
  }

  // Find the hook file
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const hookFiles = files.filter(f => f.startsWith('use'));
  if (!hookFiles.length) {
    return { pass: false, code: 'QM002', message: 'No hook file found (expected useXxx.ts)' };
  }

  // Check queryKey is exported
  const hookFile = join(dir, hookFiles[0]);
  const content = readFileSync(hookFile, 'utf8');

  const hasQueryKeyExport = /export\s+const\s+\w*[Qq]uery[Kk]ey\w*\s*=/.test(content) ||
                            /export\s+const\s+\w+Keys\s*=/.test(content) ||
                            /export\s+const\s+\w+_KEYS\s*=/.test(content);

  if (!hasQueryKeyExport) {
    return {
      pass: false, code: 'QM002',
      message: 'queryKey must be exported (e.g., export const userQueryKey = [...] or export const userKeys = {...})'
    };
  }

  return { pass: true, code: 'QM002', message: `Hook name valid: ${hookName}, queryKey exported` };
}
