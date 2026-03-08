import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * RL004 — no-undeclared-bypass
 * Rate limit bypasses (isAdmin, isInternal, skip: true) must be declared in spec.bypassConditions.
 * An undeclared bypass is a security hole.
 */

const BYPASS_PATTERNS = [
  /isAdmin|is_admin|role\s*===\s*['"]admin['"]|req\.user\.admin/i,
  /isInternal|is_internal|x-internal-request/i,
  /skip\s*:\s*true|bypassRateLimit|skipRateLimit/i,
  /whitelist|allowlist/i,
];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'rate-limit-spec.json'), 'utf8'));
  const declaredBypasses = spec.bypassConditions || [];

  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      for (const pattern of BYPASS_PATTERNS) {
        if (pattern.test(line)) {
          // Check if this bypass is declared
          const keyword = line.match(pattern)?.[0] || '';
          const isDeclared = declaredBypasses.some(b => line.includes(b) || keyword.toLowerCase().includes(b.toLowerCase()));
          if (!isDeclared) {
            violations.push(`${file.replace(dir+'/', '')}:${i+1} — undeclared bypass: ${line.trim().slice(0, 80)}`);
          }
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RL004',
      message: `${violations.length} undeclared rate limit bypass(es)`,
      detail: violations.slice(0, 10).join('\n') + '\n\nAdd bypass to spec.bypassConditions[] to acknowledge the security exception.'
    };
  }

  return { pass: true, code: 'RL004', message: `No undeclared bypasses (${files.length} file(s))` };
}
