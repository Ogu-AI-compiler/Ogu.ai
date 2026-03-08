import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DS005 — no-env-access
 * Services must not read process.env directly. Config must be injected via constructor.
 *
 * Direct process.env access in services:
 *   - Couples the service to the execution environment (untestable without env manipulation)
 *   - Breaks unit tests that don't set env vars
 *   - Makes config dependencies invisible (no type safety, no autocomplete)
 *   - Prevents config validation at startup (typos fail silently at call time)
 *
 * Correct pattern: inject a typed config object via constructor.
 *   constructor(private config: AppConfig) {}
 *   this.config.databaseUrl  // typed, validated, injectable
 */

const ENV_PATTERN = /process\.env\.[A-Za-z_]/;

function getServiceFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (f.name.match(/\.service\.ts$/) && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }

  walk(dir);
  return results;
}

export async function run({ dir }) {
  const serviceFiles = getServiceFiles(dir);

  if (serviceFiles.length === 0) {
    return { pass: true, code: 'DS005', message: 'No *.service.ts files found — skipped', skipped: true };
  }

  const violations = [];

  for (const file of serviceFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Skip comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (ENV_PATTERN.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}: ${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DS005',
      message: `${violations.length} direct process.env access(es) in service file(s)`,
      detail: violations.join('\n')
        + '\n\nInject config via constructor instead:\n'
        + '  constructor(private config: AppConfig) {}\n'
        + '  // then use: this.config.myValue',
    };
  }

  return {
    pass: true, code: 'DS005',
    message: `No direct process.env access in ${serviceFiles.length} service file(s)`,
  };
}
