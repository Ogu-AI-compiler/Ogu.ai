import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;

  // Look for component-artifact.json in the same dir or nearby
  const searchPaths = [
    join(dir, 'component-artifact.json'),
    join(root, 'component-artifact.json'),
  ];

  // Also search one level up
  const parentDir = join(dir, '..');
  const dirs = readdirSync(parentDir).map(d => join(parentDir, d, 'component-artifact.json'));
  searchPaths.push(...dirs);

  const found = searchPaths.find(p => existsSync(p));
  if (!found) {
    return {
      pass: false, skipped: true,
      code: 'A1007',
      message: 'component-artifact not found — skipping cross-compiler check'
    };
  }

  return { pass: true, code: 'A1007', message: `component-artifact found: ${found}` };
}
