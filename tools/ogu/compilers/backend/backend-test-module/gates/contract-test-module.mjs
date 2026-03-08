import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const artifactPath = join(dir, 'test-module-artifact.json');
  if (!existsSync(artifactPath)) {
    return { pass: false, code: 'BT009', message: 'test-module-artifact.json not found — run compiler first' };
  }

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'BT009', message: `test-module-artifact.json is not valid JSON: ${e.message}` };
  }

  const required = ['ir_id', 'module', 'scenarios_covered', 'test_files', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) {
    return { pass: false, code: 'BT009', message: `test-module-artifact.json missing fields: ${missing.join(', ')}` };
  }

  if (!artifact.ir_id.startsWith('TEST_MODULE:')) {
    return { pass: false, code: 'BT009', message: `ir_id must be TEST_MODULE:{module}, got: "${artifact.ir_id}"` };
  }

  if (!artifact.attestation?.hash) {
    return { pass: false, code: 'BT009', message: 'artifact.attestation.hash is missing' };
  }

  const spec = JSON.parse(readFileSync(join(dir, 'test-module-spec.json'), 'utf8'));
  if (artifact.scenarios_covered < spec.scenarios.length) {
    return {
      pass: false, code: 'BT009',
      message: `artifact.scenarios_covered (${artifact.scenarios_covered}) < spec.scenarios.length (${spec.scenarios.length})`
    };
  }

  return {
    pass: true, code: 'BT009',
    message: `Test module contract valid — ${artifact.module}, ${artifact.scenarios_covered} scenario(s) covered, ${artifact.test_files} test file(s)`
  };
}
