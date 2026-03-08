import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA027 — failure-artifacts-configured
 * spec.failureArtifacts.screenshot must be enabled.
 *
 * Without screenshots, CI failure logs are walls of text from which it is
 * nearly impossible to diagnose visual or DOM-state failures. Screenshots
 * are the minimum viable debug artifact for E2E tests.
 *
 * Validated:
 * - failureArtifacts.screenshot must be true (not false, not missing)
 * - failureArtifacts.video is accepted but not required (bandwidth cost)
 */

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'e2e-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA027', message: 'e2e-spec.json not readable' };
  }

  const artifacts = spec.failureArtifacts;
  if (!artifacts) {
    return {
      pass: false, code: 'QA027',
      message: 'failureArtifacts not configured — screenshots required for CI failure diagnosis',
      detail: 'Add:\n  "failureArtifacts": {\n    "screenshot": true,\n    "video": "on-failure"\n  }',
    };
  }

  if (artifacts.screenshot !== true) {
    return {
      pass: false, code: 'QA027',
      message: `failureArtifacts.screenshot is ${JSON.stringify(artifacts.screenshot)} — must be true`,
      detail: 'Screenshots are the minimum debug artifact. Without them, CI failures require local reproduction to diagnose.',
    };
  }

  const extras = [];
  if (artifacts.video) extras.push(`video: ${artifacts.video}`);
  if (artifacts.trace) extras.push(`trace: ${artifacts.trace}`);

  return {
    pass: true, code: 'QA027',
    message: `Failure artifacts: screenshot ✓${extras.length ? ', ' + extras.join(', ') : ''}`,
  };
}
