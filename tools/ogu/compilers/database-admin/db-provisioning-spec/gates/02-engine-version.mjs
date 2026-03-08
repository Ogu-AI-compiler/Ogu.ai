/**
 * Gate: engine-version (DPS002)
 * Validates that the declared PostgreSQL engine_version is not EOL and is a
 * supported major version. Running EOL versions means no security patches.
 *
 * EOL schedule (as of 2026): PostgreSQL 11 and below are EOL.
 * Supported: 12, 13, 14, 15, 16, 17 (and future versions with major >= 12).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const EOL_MAJOR_VERSIONS = [9, 10, 11];
const SUPPORTED_MAJOR_MIN = 12;

export async function run({ dir }) {
  const specPath = join(dir, 'db-provisioning-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DPS002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DPS002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.engine_version) {
    return {
      pass: false,
      code: 'DPS002',
      message: 'engine_version is required',
      detail: 'Declare engine_version as a string like "16.2" or "15.4"',
    };
  }

  const versionStr = String(spec.engine_version);
  const majorStr = versionStr.split('.')[0];
  const major = parseInt(majorStr, 10);

  if (isNaN(major)) {
    return {
      pass: false,
      code: 'DPS002',
      message: `engine_version "${versionStr}" is not a valid version string`,
      detail: 'Expected format: "16.2" or "15" (major or major.minor)',
    };
  }

  if (EOL_MAJOR_VERSIONS.includes(major)) {
    return {
      pass: false,
      code: 'DPS002',
      message: `PostgreSQL ${major} is EOL — use a supported version (≥ ${SUPPORTED_MAJOR_MIN})`,
      detail: `EOL versions: ${EOL_MAJOR_VERSIONS.join(', ')}. Upgrade to PostgreSQL 12 or higher.`,
    };
  }

  if (major < SUPPORTED_MAJOR_MIN) {
    return {
      pass: false,
      code: 'DPS002',
      message: `PostgreSQL ${major} is below minimum supported version (${SUPPORTED_MAJOR_MIN})`,
      detail: `Minimum supported: PostgreSQL ${SUPPORTED_MAJOR_MIN}`,
    };
  }

  return {
    pass: true,
    code: 'DPS002',
    message: `engine_version ${versionStr} is supported (major: ${major})`,
  };
}
