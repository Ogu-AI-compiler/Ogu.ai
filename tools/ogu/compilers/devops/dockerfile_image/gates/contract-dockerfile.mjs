/**
 * Gate: contract-dockerfile (DF010)
 * Enforces the dockerfile_image runtime contract: the Dockerfile must declare a
 * HEALTHCHECK (so orchestrators can detect stuck containers), a WORKDIR (so files
 * are not written to /), and must use COPY rather than ADD for local files (ADD
 * silently unpacks archives and makes builds non-reproducible).
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
  if (!dfPath) return { pass: true, code: 'DF010', message: 'No Dockerfile — skipped', skipped: true };

  const lines      = readFileSync(dfPath, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const violations = [];

  if (!lines.some(l => /^HEALTHCHECK\s/i.test(l))) {
    violations.push({
      rule:   'healthcheck-required',
      reason: 'No HEALTHCHECK instruction — container orchestrators cannot detect stuck/unhealthy containers',
      hint:   'Add: HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:${PORT}/health || exit 1',
    });
  }

  if (!lines.some(l => /^WORKDIR\s/i.test(l))) {
    violations.push({
      rule:   'workdir-required',
      reason: 'No WORKDIR instruction — files will be written to the filesystem root (/)',
      hint:   'Add: WORKDIR /app  before COPY/RUN instructions',
    });
  }

  const addLines = lines.filter(l => /^ADD\s/i.test(l) && !l.match(/^ADD\s+https?:\/\//i));
  if (addLines.length) {
    violations.push({
      rule:       'no-add-for-local-files',
      reason:     'ADD used for local files — COPY is deterministic; ADD silently unpacks archives',
      offending:  addLines,
      hint:       'Replace ADD with COPY. Use ADD only for remote URLs (ADD http://...).',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DF010',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DF010', message: 'Dockerfile contract satisfied (HEALTHCHECK, WORKDIR, no ADD)' };
}
