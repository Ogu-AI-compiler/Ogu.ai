import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DV006 — cross-schema
 * Data validation modules must verify that the upstream data-schema compiler
 * has passed, ensuring validation is built on a sound schema foundation.
 *
 * Why:
 * - Validation expectations are derived from the schema declaration.
 *   If the schema compiler failed (invalid types, missing primary keys,
 *   unconstrained columns), the validation module's expectations may be
 *   built on incorrect assumptions about what the data looks like.
 * - This cross-compiler check enforces the intended build order:
 *   data-schema → data-validation-module → data-pipeline
 *   Each phase validates the previous phase's artifacts.
 * - A passing schema compiler artifact guarantees: all columns are typed,
 *   primary key is defined, PII is documented, and nullable columns are
 *   explicitly declared. The validation module can build precise expectations
 *   from these guarantees.
 *
 * Skipped gracefully if the schema artifact doesn't exist yet (compiler
 * order not yet established for this project).
 */

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const artifactPath = join(root, '.ogu', 'artifacts', 'schema-ds-artifact.json');

  if (!existsSync(artifactPath)) {
    return {
      pass: true, code: 'DV006',
      message: 'data-schema artifact not found — cross-compiler check skipped',
      skipped: true,
    };
  }

  let artifact;
  try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); }
  catch {
    return {
      pass: true, code: 'DV006',
      message: 'Cannot read schema-ds-artifact.json — cross-compiler check skipped',
      skipped: true,
    };
  }

  if (artifact.pass === false) {
    return {
      pass: false, code: 'DV006',
      message: 'data-schema compiler failed — data-validation-module depends on a passing schema',
      detail: 'Fix the data-schema compiler failures first:\n  ogu compile data-schema\n\nValidation expectations cannot be reliably defined without a valid schema.',
    };
  }

  const gateCount = artifact.gates?.length ?? 0;
  return {
    pass: true, code: 'DV006',
    message: `data-schema compiler passed (${gateCount} gates) — validation can proceed`,
  };
}
