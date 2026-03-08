/**
 * Gate: schedule-or-trigger (BV005)
 * Validates that the verification job has at least one execution trigger.
 * A job with no schedule, trigger, or runAfterBackup flag will never run —
 * backups will be taken but never verified, creating a false sense of safety.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'backup-verify-spec.json'), 'utf8'));

  if (!spec.schedule && !spec.trigger && !spec.runAfterBackup) {
    return {
      pass: false, code: 'BV005',
      message: 'No schedule, trigger, or runAfterBackup defined — verification job will never execute',
      detail: {
        options: [
          'schedule: "0 3 * * *" — run on a cron schedule',
          'trigger: "after-backup" — trigger from another job',
          'runAfterBackup: true — automatically run after each backup completes',
        ],
        hint: 'Choose at least one execution trigger to ensure backups are regularly verified',
      },
    };
  }

  const triggerDesc = spec.schedule || spec.trigger || 'after backup';
  return { pass: true, code: 'BV005', message: `Trigger: ${triggerDesc}` };
}
