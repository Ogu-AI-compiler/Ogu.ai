import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * CV006 — startup-fail
 * The config schema must enforce that missing required keys cause startup failure.
 * We look for throw / process.exit / zod.parse / envalid.cleanEnv patterns
 * in the config module files.
 */

const STARTUP_FAIL_PATTERNS = [
  /throw\s+new\s+Error/,
  /process\.exit\(\s*1\s*\)/,
  /\.parse\s*\(/,          // zod .parse() throws on invalid
  /cleanEnv\s*\(/,         // envalid
  /z\.object\s*\(/,        // zod schema declaration
  /parseEnv\s*\(/,
  /validateSync\s*\(/,
];

function findConfigFiles(dir) {
  const candidates = ['src/config', 'config', 'src/env'];
  const files = [];
  for (const rel of candidates) {
    const p = join(dir, rel);
    if (!existsSync(p)) continue;
    try {
      const entries = readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
          files.push(join(p, e.name));
        }
      }
    } catch { /* skip */ }
  }
  // fallback: root .ts files that mention config
  if (files.length === 0) {
    try {
      const rootFiles = readdirSync(dir, { withFileTypes: true });
      for (const e of rootFiles) {
        if (!e.isDirectory() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
          const content = readFileSync(join(dir, e.name), 'utf8');
          if (content.includes('process.env') || content.includes('config')) {
            files.push(join(dir, e.name));
          }
        }
      }
    } catch { /* skip */ }
  }
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'config-spec.json'), 'utf8'));
  const requiredKeys = spec.envKeys.filter(k => k.required === true);

  if (requiredKeys.length === 0) {
    return { pass: true, code: 'CV006', message: 'No required keys — startup-fail gate not applicable', skipped: true };
  }

  const configFiles = findConfigFiles(dir);
  if (configFiles.length === 0) {
    return {
      pass: false, code: 'CV006',
      message: 'Config module files not found — cannot verify startup failure behavior'
    };
  }

  const allContent = configFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const hasFailure = STARTUP_FAIL_PATTERNS.some(p => p.test(allContent));

  if (!hasFailure) {
    return {
      pass: false, code: 'CV006',
      message: 'Config module does not enforce startup failure for invalid/missing required keys',
      detail: 'Use zod .parse(), envalid.cleanEnv(), or throw new Error() when required keys are missing.\nThe process must exit non-zero on startup if config is invalid.'
    };
  }

  return {
    pass: true, code: 'CV006',
    message: `Startup failure enforced — required keys: ${requiredKeys.map(k => k.name).join(', ')}`
  };
}
