/**
 * Gate: single-entrypoint (DF003)
 * Ensures the final Dockerfile stage has exactly one CMD or ENTRYPOINT instruction.
 * Multiple CMD instructions are silently collapsed at build time — only the last
 * takes effect, causing confusing build behaviour and making the intent unreadable.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findDockerfile(dir) {
  const candidates = ['Dockerfile', 'dockerfile', 'Dockerfile.prod', 'Dockerfile.production'];
  for (const name of candidates) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  try {
    const df = readdirSync(dir).find(e => e.toLowerCase().startsWith('dockerfile'));
    if (df) return join(dir, df);
  } catch { /* unreadable */ }
  return null;
}

export async function run({ dir }) {
  const dfPath = findDockerfile(dir);
  if (!dfPath) {
    return { pass: true, code: 'DF003', message: 'No Dockerfile — skipped', skipped: true };
  }

  const lines = readFileSync(dfPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  // In multi-stage builds only the final FROM stage counts
  const fromIndices = lines.reduce((acc, l, i) => (/^FROM\s/i.test(l) ? [...acc, i] : acc), []);
  const relevantLines = fromIndices.length > 1 ? lines.slice(fromIndices[fromIndices.length - 1]) : lines;

  const finalCmds        = relevantLines.filter(l => /^CMD\s/i.test(l));
  const finalEntrypoints = relevantLines.filter(l => /^ENTRYPOINT\s/i.test(l));
  const total            = finalCmds.length + finalEntrypoints.length;

  if (total === 0) {
    return {
      pass: false, code: 'DF003',
      message: 'No CMD or ENTRYPOINT found in final stage',
      detail: {
        hint: 'Add a CMD or ENTRYPOINT to define the container startup command. Example: CMD ["node", "server.js"]',
      },
    };
  }

  if (finalCmds.length > 1) {
    return {
      pass: false, code: 'DF003',
      message: `${finalCmds.length} CMD instructions found — only the last takes effect`,
      detail: {
        duplicates: finalCmds,
        hint: 'Remove all but the final CMD instruction, or use ENTRYPOINT + CMD pattern for parameterisable containers',
      },
    };
  }

  const kind = finalEntrypoints.length > 0 ? 'ENTRYPOINT' : 'CMD';
  return { pass: true, code: 'DF003', message: `Single entrypoint defined (${kind})` };
}
