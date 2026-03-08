import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SR004 — secrets-redacted
 * Secret headers (Authorization, X-Api-Key, etc.) must not appear in log statements without redaction.
 * Pattern: if a secret header value is logged alongside the header name, it must be redacted.
 */

const LOG_PATTERNS = [
  /console\.(log|info|debug|warn|error)/,
  /logger\.(log|info|debug|warn|error)/,
  /pino\.|winston\.|bunyan\./,
];

const SECRET_HEADER_PATTERNS = [
  /[Aa]uthorization/,
  /[Xx]-[Aa]pi-[Kk]ey/,
  /[Xx]-[Aa]uth/,
  /[Bb]earer/,
  /[Aa]pi[Kk]ey/,
  /[Ss]ecret/,
  /[Pp]assword/,
  /[Tt]oken/,
];

const REDACTION_PATTERNS = [
  /redact/i,
  /\*{3,}/,
  /\[REDACTED\]/,
  /\[HIDDEN\]/,
  /slice\(0,\s*[0-9]+\)/,    // partial reveal
  /\.replace/,
  /'\*+'/,
];

function getAllTsFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.ogu', '.git'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|js)$/) && !e.name.includes('.d.ts')) {
        results.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'client-runtime-spec.json'), 'utf8'));

  const secretHeaders = [
    ...(spec.secretHeaders || []),
    'Authorization', 'X-Api-Key', 'X-Auth-Token',
  ].map(h => h.toLowerCase());

  const violations = [];
  const allFiles = getAllTsFiles(dir);

  for (const file of allFiles) {
    if (file.includes('.test.') || file.includes('.spec.')) continue;

    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      const isLogLine = LOG_PATTERNS.some(p => p.test(line));
      if (!isLogLine) return;

      const hasSecretHeader = SECRET_HEADER_PATTERNS.some(p => p.test(line));
      if (!hasSecretHeader) return;

      // Check surrounding context for redaction
      const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
      const isRedacted = REDACTION_PATTERNS.some(p => p.test(context));

      if (!isRedacted) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — secret header in log without redaction: ${line.trim().slice(0, 80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SR004',
      message: `${violations.length} secret header(s) logged without redaction`,
      detail: violations.join('\n') + '\n\nFix: Use { Authorization: "[REDACTED]" } or redact() helper in log calls'
    };
  }

  return { pass: true, code: 'SR004', message: 'No secret header leaks in log statements' };
}
