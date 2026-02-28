import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gate Runner — runs verification gates against built output.
 *
 * Gate types:
 *   - file-exists: Check that a file exists
 *   - export-exists: Check that a file exports a specific name
 *   - no-pattern: Check that no files matching a glob contain a pattern
 *
 * @param {string} root - Repo root
 * @param {Array<object>} expectations - From Spec.json
 * @returns {Array<{name: string, type: string, passed: boolean, message?: string, durationMs: number}>}
 */
export function runGates(root, expectations) {
  const results = [];

  for (const exp of expectations) {
    const start = Date.now();
    let passed = false;
    let message = '';

    switch (exp.type) {
      case 'file-exists': {
        const fullPath = join(root, exp.path);
        passed = existsSync(fullPath);
        message = passed ? `File exists: ${exp.path}` : `File missing: ${exp.path}`;
        break;
      }

      case 'export-exists': {
        const fullPath = join(root, exp.path);
        if (!existsSync(fullPath)) {
          passed = false;
          message = `File missing: ${exp.path}`;
        } else {
          const content = readFileSync(fullPath, 'utf8');
          // Check for named export pattern
          const exportRegex = new RegExp(
            `export\\s+(function|const|let|var|class)\\s+${exp.export}\\b|export\\s*\\{[^}]*\\b${exp.export}\\b`
          );
          passed = exportRegex.test(content);
          message = passed
            ? `Export "${exp.export}" found in ${exp.path}`
            : `Export "${exp.export}" NOT found in ${exp.path}`;
        }
        break;
      }

      case 'no-pattern': {
        // Check that pattern doesn't appear in matching files
        const dir = join(root, exp.path.replace('/**', '').replace('/*', ''));
        if (!existsSync(dir)) {
          passed = true;
          message = `Directory doesn't exist (no pattern possible): ${dir}`;
        } else {
          const files = readdirSync(dir, { recursive: true })
            .filter(f => typeof f === 'string' && f.endsWith('.mjs') || f.endsWith('.js') || f.endsWith('.ts'));

          let found = false;
          for (const file of files) {
            const filePath = join(dir, file);
            try {
              const content = readFileSync(filePath, 'utf8');
              if (content.includes(exp.pattern)) {
                found = true;
                message = `Pattern "${exp.pattern}" found in ${file}`;
                break;
              }
            } catch { /* skip unreadable files */ }
          }
          passed = !found;
          if (passed) message = `No "${exp.pattern}" found in ${exp.path}`;
        }
        break;
      }

      default:
        message = `Unknown gate type: ${exp.type}`;
        passed = false;
    }

    results.push({
      name: `${exp.type}: ${exp.path}${exp.export ? '.' + exp.export : ''}`,
      type: exp.type,
      passed,
      message,
      durationMs: Date.now() - start,
    });
  }

  return results;
}

/**
 * Check for drift: are all spec expectations met?
 */
export function checkDrift(gateResults) {
  const failed = gateResults.filter(g => !g.passed);
  return {
    drifted: failed.length > 0,
    failedChecks: failed.length,
    totalChecks: gateResults.length,
    details: failed.map(g => g.message),
  };
}
