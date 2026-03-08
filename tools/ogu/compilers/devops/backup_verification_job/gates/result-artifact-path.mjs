/**
 * Gate: result-artifact-path (BV004)
 * Validates that a resultArtifactPath is declared. Verification results must
 * be written to a known path so that the CI/CD pipeline can read the outcome
 * and gate the deployment on a successful verification.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'backup-verify-spec.json'), 'utf8'));

  if (!spec.resultArtifactPath) {
    return {
      pass: false, code: 'BV004',
      message: 'No resultArtifactPath defined — verification result must be emitted to a known path',
      detail: {
        hint: 'Add resultArtifactPath: "backup-verify-result.json" so the pipeline can read and gate on the verification outcome',
      },
    };
  }

  return { pass: true, code: 'BV004', message: `Result artifact: ${spec.resultArtifactPath}` };
}
