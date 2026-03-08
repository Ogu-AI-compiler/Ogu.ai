/**
 * Gate: base-image-pinned (DF004)
 * Verifies that every FROM instruction uses a pinned image tag or digest, not :latest
 * or an implicit latest. Floating tags cause non-deterministic builds — the same
 * Dockerfile can produce different images on successive builds.
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
  if (!dfPath) return { pass: true, code: 'DF004', message: 'No Dockerfile — skipped', skipped: true };

  const lines = readFileSync(dfPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => !l.startsWith('#'));

  const violations = [];

  for (const line of lines.filter(l => /^FROM\s/i.test(l))) {
    if (/^FROM\s+scratch$/i.test(line)) continue; // scratch is a valid untagged base
    const match = line.match(/^FROM\s+([^\s]+)(\s+AS\s+\S+)?/i);
    if (!match) continue;
    const image = match[1];

    if (image.endsWith(':latest')) {
      violations.push({ line, reason: 'uses ":latest" tag — not deterministic' });
    } else if (!image.includes(':') && !image.includes('@')) {
      violations.push({ line, reason: 'no version tag or digest — implicitly uses :latest' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DF004',
      message: `${violations.length} unpinned base image(s)`,
      detail: {
        violations,
        hint: 'Pin images to a specific version or digest. Examples: node:20.11-alpine, node@sha256:abc123...',
      },
    };
  }

  const fromCount = lines.filter(l => /^FROM\s/i.test(l)).length;
  return { pass: true, code: 'DF004', message: `All ${fromCount} base image(s) are pinned` };
}
