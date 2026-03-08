/**
 * Gate: dockerfile-exists (DF002)
 * Verifies that a Dockerfile is present in the target directory. All other Dockerfile
 * gates depend on this file existing. Accepts standard naming variants used by multi-env
 * setups: Dockerfile, Dockerfile.prod, Dockerfile.production.
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const CANONICAL_NAMES = ['Dockerfile', 'dockerfile', 'Dockerfile.prod', 'Dockerfile.production'];

export async function run({ dir }) {
  for (const name of CANONICAL_NAMES) {
    if (existsSync(join(dir, name))) {
      return { pass: true, code: 'DF002', message: `Dockerfile found: ${name}` };
    }
  }

  // Also accept any file prefixed with "Dockerfile" (e.g. Dockerfile.builder)
  let discovered = null;
  try {
    discovered = readdirSync(dir).find(e => e.toLowerCase().startsWith('dockerfile'));
  } catch { /* unreadable dir — will fail below */ }

  if (discovered) {
    return { pass: true, code: 'DF002', message: `Dockerfile found: ${discovered}` };
  }

  return {
    pass: false, code: 'DF002',
    message: 'No Dockerfile found in target directory',
    detail: {
      searched: CANONICAL_NAMES,
      hint: 'Create a Dockerfile at the root of the build context. For multi-env setups, Dockerfile.prod is also accepted.',
    },
  };
}
