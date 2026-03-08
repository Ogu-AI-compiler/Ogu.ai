/**
 * Gate: dockerignore-present (DF007)
 * Checks that a .dockerignore file exists. Without it, the entire build context is
 * sent to the Docker daemon — including .git, node_modules, .env files, and logs —
 * which bloats the build and risks leaking secrets into the image layer.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const RECOMMENDED = ['.git', 'node_modules', '.env', '*.log'];

export async function run({ dir }) {
  const ignorePath = join(dir, '.dockerignore');

  if (!existsSync(ignorePath)) {
    return {
      pass: false, code: 'DF007',
      message: '.dockerignore not found',
      detail: {
        recommended: RECOMMENDED,
        hint: 'Create .dockerignore at the build context root. At minimum exclude: .git, node_modules, .env files, and *.log',
      },
    };
  }

  const entries = readFileSync(ignorePath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const missing = RECOMMENDED.filter(r =>
    !entries.some(e => e === r || e.includes(r.replace('*.', '')))
  );

  // Gate passes either way — missing recommended entries is advisory only
  return {
    pass: true, code: 'DF007',
    message: `.dockerignore present (${entries.length} entries)${missing.length ? ` — consider adding: ${missing.join(', ')}` : ''}`,
  };
}
