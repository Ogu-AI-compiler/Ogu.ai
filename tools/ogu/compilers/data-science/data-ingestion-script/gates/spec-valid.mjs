import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * DI001 — spec-valid
 * Validates that ingestion-spec.json exists and contains all required fields.
 *
 * Why:
 * - A missing spec means there is no contract for what this ingestion script
 *   does: no declared source, no expected output format, no downstream
 *   consumers know what to expect.
 * - The format field prevents ambiguity: a script that "writes CSV" may
 *   write quoted CSV, unquoted CSV, or TSV. The spec makes it explicit.
 * - Machine-readable specs enable tooling: pipeline orchestrators can
 *   validate input/output compatibility without reading Python code.
 *
 * Escape hatch: none — a spec file is required for all non-trivial ingestion scripts.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'ingestion-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'DI001', message: 'ingestion-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'DI001', message: 'ingestion-spec.json is invalid JSON' }; }

  const required = ['source', 'output_path', 'format'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'DI001', message: `ingestion-spec.json missing: ${missing.join(', ')}` };
  }

  const VALID_FORMATS = ['csv', 'parquet', 'json', 'jsonl', 'excel', 'sql', 'api'];
  if (!VALID_FORMATS.includes(spec.format)) {
    return {
      pass: false, code: 'DI001',
      message: `Unknown format: "${spec.format}" — use one of: ${VALID_FORMATS.join(', ')}`,
    };
  }

  return { pass: true, code: 'DI001', message: `Spec valid: ${spec.source} → ${spec.format}` };
}
