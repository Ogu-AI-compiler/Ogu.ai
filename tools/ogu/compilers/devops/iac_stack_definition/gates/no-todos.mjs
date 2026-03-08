/**
 * Gate: no-todos (IAC007)
 * Scans all IaC files (.tf, .yaml, iac-spec.json) for TODO, FIXME, HACK, PLACEHOLDER,
 * and XXX markers. A placeholder in IaC code is an unresolved infrastructure decision —
 * it will cause `terraform plan` to produce unpredictable results.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

function getAllIaCFiles(dir) {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.tf') || f.endsWith('.yaml') || f === 'iac-spec.json')
      .map(f => join(dir, f));
  } catch { return []; }
}

export async function run({ dir }) {
  const files      = getAllIaCFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (TODO_PATTERN.test(line)) {
        violations.push({ file: file.replace(dir + '/', ''), line: i + 1, content: line.trim() });
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'IAC007',
      message: `${violations.length} TODO/FIXME marker(s) found in IaC files`,
      detail: {
        violations,
        hint: 'Resolve all placeholder markers before running terraform plan — each TODO represents an incomplete infrastructure decision',
      },
    };
  }

  return { pass: true, code: 'IAC007', message: `No TODO/FIXME markers in ${files.length} IaC file(s)` };
}
