/**
 * Gate: checksum-method (RVS005)
 * checksum_method must be a specific, recognized data integrity verification
 * method. Vague strings like "manual" or "visual" are not checksums.
 *
 * Valid methods:
 * - "pg_dump_md5"    — MD5 of pg_dump output
 * - "pg_dump_sha256" — SHA256 of pg_dump output (preferred)
 * - "table_count"    — row count comparison
 * - "table_checksum" — PostgreSQL pg_catalog checksum
 * - "pitr_lsn"       — WAL LSN position comparison for PITR
 * - "custom"         — custom method (requires checksum_method_description)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_CHECKSUM_METHODS = [
  'pg_dump_md5',
  'pg_dump_sha256',
  'table_count',
  'table_checksum',
  'pitr_lsn',
  'custom',
];

const VAGUE_METHODS = ['manual', 'visual', 'check', 'verify', 'tbd', 'none', 'n/a'];

export async function run({ dir }) {
  const specPath = join(dir, 'restore-verification-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RVS005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RVS005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.checksum_method) {
    return {
      pass: false,
      code: 'RVS005',
      message: 'checksum_method is required',
      detail: `Valid methods: ${VALID_CHECKSUM_METHODS.join(', ')}`,
    };
  }

  const method = String(spec.checksum_method).toLowerCase().trim();

  if (VAGUE_METHODS.includes(method)) {
    return {
      pass: false,
      code: 'RVS005',
      message: `checksum_method "${spec.checksum_method}" is not a verifiable method`,
      detail:
        `"${spec.checksum_method}" is not machine-verifiable.\n` +
        `Use a specific method: ${VALID_CHECKSUM_METHODS.join(', ')}`,
    };
  }

  if (!VALID_CHECKSUM_METHODS.includes(method)) {
    return {
      pass: false,
      code: 'RVS005',
      message: `checksum_method "${spec.checksum_method}" is not recognized`,
      detail: `Valid methods: ${VALID_CHECKSUM_METHODS.join(', ')}`,
    };
  }

  // "custom" requires a description
  if (method === 'custom' && !spec.checksum_method_description) {
    return {
      pass: false,
      code: 'RVS005',
      message: 'checksum_method "custom" requires a checksum_method_description',
      detail: 'When using a custom checksum method, declare checksum_method_description explaining how integrity is verified.',
    };
  }

  return {
    pass: true,
    code: 'RVS005',
    message: `checksum_method "${spec.checksum_method}" is a recognized verification method`,
  };
}
