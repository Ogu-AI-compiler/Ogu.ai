import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA052 — publish-results-true
 * Contract test results must be published to the broker on CI.
 *
 * Without publishing:
 *   - The provider cannot verify it satisfies the consumer's contract
 *   - Can-I-Deploy checks are meaningless (no data to check against)
 *   - Consumer and provider teams are decoupled in name only
 *
 * Required: spec.publishResults: true OR spec.publish.onCI: true
 *
 * If spec.broker is not declared, this gate is skipped.
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'contract-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA052', message: 'contract-test-spec.json not readable' }; }

  if (!spec.broker) {
    return { pass: true, code: 'QA052', message: 'No broker declared — publish not applicable', skipped: true };
  }

  // Accept several config shapes
  const publishResults = spec.publishResults
    ?? spec.publish?.results
    ?? spec.publish?.onCI
    ?? spec.broker?.publish
    ?? spec.broker?.publishResults;

  if (publishResults === undefined || publishResults === null) {
    return {
      pass: false, code: 'QA052',
      message: 'publishResults not declared — contract results will not reach the broker',
      detail: 'Add "publishResults": true to the spec. Without publishing, provider verification and can-i-deploy checks cannot function.',
    };
  }

  if (publishResults === false) {
    return {
      pass: false, code: 'QA052',
      message: 'publishResults is false — consumer-driven contracts require publishing to be effective',
      detail: 'Set "publishResults": true. This is required for provider teams to verify the contract.',
    };
  }

  // Check consumerVersion is declared when publishing is enabled
  const consumerVersion = spec.consumerVersion ?? spec.publish?.consumerVersion ?? spec.broker?.consumerVersion;
  if (!consumerVersion) {
    return {
      pass: false, code: 'QA052',
      message: 'publishResults: true but consumerVersion not declared',
      detail: 'The broker requires a version tag to identify which consumer version produced these contracts.\nAdd: "consumerVersion": "${GIT_COMMIT}" or similar.',
    };
  }

  return { pass: true, code: 'QA052', message: `publishResults: true, consumerVersion: ${consumerVersion}` };
}
