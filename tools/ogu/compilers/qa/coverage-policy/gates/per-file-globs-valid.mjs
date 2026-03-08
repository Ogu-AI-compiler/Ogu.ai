import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import { readFileSync } from 'fs';

/**
 * QA015 — per-file-globs-valid
 * Every glob pattern in spec.perFile must match at least one actual file
 * in the project. A glob that matches nothing silently does nothing —
 * developers think critical paths are protected when they aren't.
 *
 * Uses a simple manual glob matcher that handles:
 * - ** (any path segments)
 * - * (any characters except /)
 * - ? (any single character except /)
 * - Literal path segments
 *
 * Skipped if spec.perFile is not defined or empty.
 */

function escapeRegex(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(pattern) {
  // Convert glob to regex
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i += 2;
      if (pattern[i] === '/') i++; // consume trailing slash
    } else if (pattern[i] === '*') {
      re += '[^/]*';
      i++;
    } else if (pattern[i] === '?') {
      re += '[^/]';
      i++;
    } else {
      re += escapeRegex(pattern[i]);
      i++;
    }
  }
  return new RegExp('^' + re + '$');
}

function collectAllFiles(dir) {
  const files = [];
  function walk(d, rel) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name), rel + f.name + '/');
      } else {
        files.push(rel + f.name);
      }
    }
  }
  walk(dir, '');
  return files;
}

export async function run({ dir, projectRoot }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'coverage-policy-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA015', message: 'coverage-policy-spec.json not readable' };
  }

  const perFile = spec.perFile;
  if (!perFile || typeof perFile !== 'object' || Object.keys(perFile).length === 0) {
    return {
      pass: true, code: 'QA015',
      message: 'No perFile thresholds defined — skipped',
      skipped: true,
    };
  }

  const root = projectRoot || dir;
  const allFiles = collectAllFiles(root);
  const violations = [];

  for (const pattern of Object.keys(perFile)) {
    // Normalise: strip leading ./ or /
    const normalised = pattern.replace(/^\.\//, '').replace(/^\//, '');
    const regex = globToRegex(normalised);
    const matches = allFiles.filter(f => regex.test(f));
    if (matches.length === 0) {
      violations.push(`"${pattern}" matches no files in project (${allFiles.length} files scanned)`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA015',
      message: `${violations.length} perFile glob pattern(s) match no files`,
      detail: violations.join('\n') + '\n\nFix the pattern or remove stale per-file threshold entries.',
    };
  }

  return {
    pass: true, code: 'QA015',
    message: `All ${Object.keys(perFile).length} perFile glob(s) match at least one file`,
  };
}
