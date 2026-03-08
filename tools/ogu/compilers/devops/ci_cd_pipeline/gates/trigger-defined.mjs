/**
 * Gate: trigger-defined (CIP002)
 * Ensures the pipeline has at least one valid trigger. A pipeline with no triggers
 * is inert — it will never execute automatically, which defeats the purpose of CI/CD.
 * Also rejects unknown trigger names that the platform won't recognise.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_TRIGGERS = ['push', 'pull_request', 'merge_request', 'schedule', 'manual', 'tag', 'workflow_dispatch', 'release'];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'ci-cd-spec.json'), 'utf8'));

  if (!spec.triggers || spec.triggers.length === 0) {
    return {
      pass: false, code: 'CIP002',
      message: 'No triggers defined — pipeline will never execute automatically',
      detail: {
        allowedTriggers: VALID_TRIGGERS,
        hint: 'Add at least one trigger. Typical: ["push", "pull_request"] for standard CI.',
      },
    };
  }

  const invalid = spec.triggers.filter(t => !VALID_TRIGGERS.includes(t));
  if (invalid.length) {
    return {
      pass: false, code: 'CIP002',
      message: `Unknown trigger(s): ${invalid.join(', ')}`,
      detail: {
        invalid,
        allowedTriggers: VALID_TRIGGERS,
        hint: 'Remove unrecognised triggers — the platform will silently ignore them, making the pipeline non-deterministic',
      },
    };
  }

  return {
    pass: true, code: 'CIP002',
    message: `${spec.triggers.length} trigger(s) defined: ${spec.triggers.join(', ')}`,
  };
}
