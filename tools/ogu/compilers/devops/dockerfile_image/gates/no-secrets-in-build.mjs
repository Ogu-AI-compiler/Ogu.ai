/**
 * Gate: no-secrets-in-build (DF006)
 * Detects credentials embedded in Dockerfile ARG or ENV instructions. Build args and
 * environment variables baked into an image layer are readable by anyone who can pull
 * the image — they are permanently stored in the image manifest.
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

/** Heuristic patterns that suggest a secret value is being baked in */
const SECRET_KEY_RE  = /(?:password|passwd|secret|token|api_key|apikey|private_key|credentials|auth_token)/i;
const HAS_VALUE_RE   = /=\s*[^\s$"']{4,}|=\s*["'][^"']{4,}["']/;

export async function run({ dir }) {
  const dfPath = findDockerfile(dir);
  if (!dfPath) return { pass: true, code: 'DF006', message: 'No Dockerfile — skipped', skipped: true };

  const lines      = readFileSync(dfPath, 'utf8').split('\n');
  const violations = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return;
    // Only flag ARG/ENV lines with secret-sounding names that have a non-placeholder value
    if (/^(?:ARG|ENV)\s/i.test(trimmed) && SECRET_KEY_RE.test(trimmed) && HAS_VALUE_RE.test(trimmed)) {
      violations.push({ line: i + 1, content: trimmed });
    }
  });

  if (violations.length) {
    return {
      pass: false, code: 'DF006',
      message: `${violations.length} potential secret(s) embedded in Dockerfile`,
      detail: {
        violations,
        hint: 'Use runtime secret injection instead of ARG/ENV in the Dockerfile. Options: --secret flag (BuildKit), k8s Secrets, or Vault dynamic injection.',
      },
    };
  }

  return { pass: true, code: 'DF006', message: 'No secret values in Dockerfile ARG/ENV' };
}
