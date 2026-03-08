/**
 * Gate UXS008 — no-todos
 * No TODO/FIXME/HACK/TBD in state-matrix-spec.json or supporting JSON files.
 * These markers indicate incomplete state coverage.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function collectJsonFiles(dir) {
  const files = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const f of entries) {
    if (f.isDirectory()) continue;
    if (f.name.endsWith('.json') && !f.name.startsWith('.')) {
      files.push(join(dir, f.name));
    }
  }
  return files;
}

export async function run({ dir }) {
  const files = collectJsonFiles(dir);
  if (files.length === 0) {
    return { pass: true, code: 'UXS008', message: 'No JSON files found — skipped', skipped: true };
  }

  const violations = [];
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    content.split('\n').forEach((line, i) => {
      if (/\b(?:TODO|FIXME|HACK|TBD)\b/.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — ${line.trim().slice(0, 80)}`);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS008',
      message: `${violations.length} TODO/FIXME/HACK/TBD marker(s) found`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS008',
    message: `no-todos: clean (${files.length} file(s) checked)`,
  };
}
