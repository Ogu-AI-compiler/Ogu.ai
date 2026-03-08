/**
 * Gate: no-todos (SJ007)
 * Scans scheduled-job-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder cron schedules or image tags will cause the CronJob to run at
 * unintended times or fail to pull the container image.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'SJ007',
      message: `${violations.length} TODO/FIXME marker(s) found in scheduled-job-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real cron expressions, image tags, and command paths — placeholder values cause the CronJob to fail at admission or runtime',
      },
    };
  }

  return { pass: true, code: 'SJ007', message: 'No TODO/FIXME markers in scheduled-job-spec.json' };
}
