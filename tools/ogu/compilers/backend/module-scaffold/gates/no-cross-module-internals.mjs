import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MS004 — no-cross-module-internals
 * Cross-module imports must go through the target module's public entrypoint (index.ts).
 * Importing directly from another module's internal folder is forbidden.
 *
 * BAD:  import { X } from '../../other-module/services/x.service'
 * GOOD: import { X } from '../../other-module'
 */

const INTERNAL_FOLDERS = ['services', 'repositories', 'workflows', 'clients', 'events', 'jobs', 'webhooks', 'cache', 'graphql'];

function getAllTsFiles(dir) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.ogu', '.git', 'coverage'].includes(e.name)) continue;
      results.push(...getAllTsFiles(join(dir, e.name)));
    } else if (e.name.endsWith('.ts') && !e.name.includes('.d.ts')) {
      results.push(join(dir, e.name));
    }
  }
  return results;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'module-spec.json'), 'utf8'));
  const moduleName = spec.name;

  // Pattern: import from '../<otherModule>/{internalFolder}/...'
  // We look for imports that traverse into another module's internal directory
  const crossInternalPattern = new RegExp(
    `from ['"](?:\\.\\./)+(?:src/modules/)?([^/'"]+)/(${INTERNAL_FOLDERS.join('|')})/`
  );

  const allFiles = getAllTsFiles(dir);
  const violations = [];

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const m = crossInternalPattern.exec(line);
      if (m && m[1] !== moduleName) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — imports internal folder of module "${m[1]}": ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'MS004',
      message: `${violations.length} cross-module internal import(s) found`,
      detail: violations.join('\n') + '\n\nFix: import from the module\'s index.ts instead'
    };
  }

  return { pass: true, code: 'MS004', message: 'No cross-module internal imports detected' };
}
