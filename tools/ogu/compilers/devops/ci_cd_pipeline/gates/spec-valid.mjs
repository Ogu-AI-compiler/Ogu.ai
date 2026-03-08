/**
 * Gate: spec-valid (CIP001)
 * Validates that ci-cd-spec.json exists, is valid JSON, and contains all required
 * top-level fields. This is the entry gate — all other ci_cd_pipeline gates assume
 * spec-valid has already passed and the spec is structurally sound.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_PLATFORMS = ['github', 'gitlab', 'jenkins', 'circleci', 'buildkite'];

export async function run({ dir }) {
  const specPath = join(dir, 'ci-cd-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'CIP001',
      message: 'ci-cd-spec.json not found',
      detail: { hint: 'Create ci-cd-spec.json with: { platform, triggers: [], stages: [], jobs: [] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'CIP001',
      message: `ci-cd-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  const missing = ['platform', 'triggers', 'stages', 'jobs'].filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'CIP001',
      message: `Missing required fields: ${missing.join(', ')}`,
      detail: {
        missing,
        hint: 'Required shape: { platform: "github"|"gitlab"|"jenkins"|"circleci"|"buildkite", triggers: string[], stages: string[], jobs: [{ name, stage, steps }] }',
      },
    };
  }

  if (!VALID_PLATFORMS.includes(spec.platform)) {
    return {
      pass: false, code: 'CIP001',
      message: `Invalid platform: "${spec.platform}"`,
      detail: { allowedValues: VALID_PLATFORMS, received: spec.platform },
    };
  }

  for (const field of ['triggers', 'stages', 'jobs']) {
    if (!Array.isArray(spec[field]) || spec[field].length === 0) {
      return {
        pass: false, code: 'CIP001',
        message: `"${field}" must be a non-empty array`,
        detail: { field, received: spec[field], hint: `Add at least one entry to ${field}` },
      };
    }
  }

  return {
    pass: true, code: 'CIP001',
    message: `ci-cd-spec.json valid — platform: ${spec.platform}, ${spec.jobs.length} jobs, ${spec.stages.length} stages`,
  };
}
