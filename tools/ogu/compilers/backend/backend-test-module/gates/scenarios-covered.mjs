import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * BT002 — scenarios-covered
 * Every scenario id in the spec must appear in at least one test file.
 * Convention: scenario id appears as describe/it/test string or as a comment.
 */

function findTestFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(test|spec)\.(ts|mjs|js)$/)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'test-module-spec.json'), 'utf8'));
  const testFiles = findTestFiles(dir);

  if (testFiles.length === 0) {
    return { pass: false, code: 'BT002', message: 'No test files found — cannot verify scenario coverage' };
  }

  const allTestContent = testFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const uncovered = [];

  for (const scenario of spec.scenarios) {
    // Check for scenario id or a meaningful substring of description
    const idMatch = allTestContent.includes(scenario.id);
    const descMatch = scenario.description && allTestContent.includes(scenario.description.slice(0, 20));
    if (!idMatch && !descMatch) {
      uncovered.push(`${scenario.id}: "${scenario.description}"`);
    }
  }

  if (uncovered.length) {
    return {
      pass: false, code: 'BT002',
      message: `${uncovered.length} scenario(s) with no matching test`,
      detail: uncovered.join('\n') + '\n\nEach scenario.id or description must appear in a test file.'
    };
  }

  return {
    pass: true, code: 'BT002',
    message: `All ${spec.scenarios.length} scenario(s) covered in ${testFiles.length} test file(s)`
  };
}
