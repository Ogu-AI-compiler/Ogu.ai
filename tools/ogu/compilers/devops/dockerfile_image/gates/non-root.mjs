/**
 * Gate: non-root (DF005)
 * Ensures the container does not run as root. Missing USER instruction or an explicit
 * USER root means the process runs with uid 0, which allows container escape in the
 * event of a container runtime vulnerability.
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
  if (!dfPath) return { pass: true, code: 'DF005', message: 'No Dockerfile — skipped', skipped: true };

  const lines = readFileSync(dfPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => !l.startsWith('#'));

  const userLines = lines.filter(l => /^USER\s/i.test(l));

  if (userLines.length === 0) {
    return {
      pass: false, code: 'DF005',
      message: 'No USER instruction — container will run as root',
      detail: {
        hint: 'Add a non-root user before the final CMD/ENTRYPOINT:\n  RUN addgroup -S appgroup && adduser -S appuser -G appgroup\n  USER appuser',
      },
    };
  }

  // Check that the last USER in the final stage is not root
  const lastUser = userLines[userLines.length - 1];
  const userVal  = lastUser.replace(/^USER\s+/i, '').trim();

  if (userVal === 'root' || userVal === '0') {
    return {
      pass: false, code: 'DF005',
      message: `Final USER instruction sets root: "${lastUser}"`,
      detail: {
        instruction: lastUser,
        hint: 'The last USER in the final build stage must be a non-root user (not "root" or uid 0)',
      },
    };
  }

  return { pass: true, code: 'DF005', message: `Non-root user set: USER ${userVal}` };
}
