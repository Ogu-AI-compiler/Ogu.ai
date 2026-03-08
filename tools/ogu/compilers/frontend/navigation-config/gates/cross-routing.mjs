import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const searchPaths = [
    join(dir, 'routing-artifact.json'),
    join(root, 'routing-artifact.json'),
  ];
  const parentDir = join(dir, '..');
  try {
    readdirSync(parentDir).forEach(d => searchPaths.push(join(parentDir, d, 'routing-artifact.json')));
  } catch { /* skip */ }

  const found = searchPaths.find(p => existsSync(p));
  if (!found) {
    return { pass: false, skipped: true, code: 'NC009', message: 'routing-artifact not found — compile routing-config first (skipping)' };
  }

  return { pass: true, code: 'NC009', message: `routing-artifact found: ${found}` };
}
