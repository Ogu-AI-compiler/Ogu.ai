/**
 * Gate: job-template-valid (SJ003)
 * Validates that the job template declares both a command and an image.
 * A job without an image cannot be scheduled; a job without a command
 * will run the container's default entrypoint, which may not be the
 * intended job logic.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.command) violations.push({ field: 'command', reason: 'No command declared — job will run the container default entrypoint which may not be the intended job logic' });
  if (!spec.image)   violations.push({ field: 'image',   reason: 'No image declared — job cannot be scheduled without a container image' });

  if (violations.length) {
    return {
      pass: false, code: 'SJ003',
      message: `Job template missing required field(s): ${violations.map(v => v.field).join(', ')}`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SJ003', message: 'Job template is complete' };
}
