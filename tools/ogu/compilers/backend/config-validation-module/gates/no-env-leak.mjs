import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * CV004 — no-env-leak
 * Ensures that `process.env.*` is not accessed directly outside the config module boundary.
 * The config module is the ONLY place allowed to read from process.env.
 */

const CONFIG_MODULE_PATHS = [
  'src/config',
  'config',
  'src/env',
];

function getAllTsFiles(dir, root) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, dist, .ogu
      if (['node_modules', 'dist', '.ogu', '.git', 'coverage'].includes(entry.name)) continue;
      results.push(...getAllTsFiles(full, root));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

function isInsideConfigModule(filePath, dir) {
  const relative = filePath.replace(dir + '/', '');
  return CONFIG_MODULE_PATHS.some(p => relative.startsWith(p));
}

export async function run({ dir }) {
  const processEnvPattern = /process\.env\.[A-Z_a-z]/;

  const allFiles = getAllTsFiles(dir, dir);
  const violations = [];

  for (const file of allFiles) {
    // Skip test files
    if (file.includes('.test.') || file.includes('.spec.')) continue;

    // Skip if inside config module boundary
    if (isInsideConfigModule(file, dir)) continue;

    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (processEnvPattern.test(line) && !line.trim().startsWith('//')) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — direct process.env access: ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'CV004',
      message: `${violations.length} direct process.env access(es) found outside config module`,
      detail: violations.slice(0, 10).join('\n') + (violations.length > 10 ? `\n... and ${violations.length - 10} more` : '')
    };
  }

  return {
    pass: true, code: 'CV004',
    message: 'No process.env access outside config module boundary'
  };
}
