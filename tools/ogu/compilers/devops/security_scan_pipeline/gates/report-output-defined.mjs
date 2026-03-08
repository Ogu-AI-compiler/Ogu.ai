/**
 * Gate: report-output-defined (SS005)
 * Validates that a report output path and format are configured. Without a
 * defined output, security scan results are printed to stdout and lost —
 * findings cannot be tracked, compared across releases, or uploaded to a
 * security dashboard.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_FORMATS = new Set(['json', 'sarif', 'junit', 'html', 'table', 'cyclonedx']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'security-scan-spec.json'), 'utf8'));

  if (!spec.output) {
    return {
      pass: false, code: 'SS005',
      message: 'output configuration not defined — scan results will be lost',
      detail: { hint: 'Add an output section with path and format fields to persist scan results' },
    };
  }

  const violations = [];

  if (!spec.output.path) {
    violations.push({ field: 'output.path', reason: 'output.path is required — scan results will not be written to disk', hint: 'Set output.path to a file path (e.g., "security-report.sarif")' });
  }
  if (!spec.output.format) {
    violations.push({ field: 'output.format', reason: 'output.format is required', hint: `Use one of: ${[...VALID_FORMATS].join(', ')}` });
  } else if (!VALID_FORMATS.has(spec.output.format.toLowerCase())) {
    violations.push({ field: 'output.format', received: spec.output.format, allowed: [...VALID_FORMATS], reason: `"${spec.output.format}" is not a recognised report format` });
  }

  if (violations.length) {
    return {
      pass: false, code: 'SS005',
      message: `${violations.length} output config issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SS005', message: 'Report output configuration valid' };
}
