import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PWS007 — no-direct-draft-to-published: draft cannot transition directly to published without review
 *  unless explicitly marked allowDirectPublish:true in the spec.
 */
export async function run({ dir }) {
  const specPath = join(dir, 'publishing-workflow-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'PWS007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PWS007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // Escape hatch: explicit policy decision to allow direct publishing
  if (spec.allowDirectPublish === true) {
    return {
      pass: true,
      code: 'PWS007',
      message: 'allowDirectPublish:true — direct draft→published permitted',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.states) || spec.states.length === 0) {
    return { pass: true, code: 'PWS007', message: 'No states defined — gate skipped', skipped: true };
  }

  const draftState = spec.states.find(s => s.id === 'draft');

  if (!draftState) {
    return { pass: true, code: 'PWS007', message: 'No "draft" state — gate skipped', skipped: true };
  }

  const transitions = draftState.transitions || {};
  const draftTargets = Object.values(transitions).filter(t => typeof t === 'string');
  const goesDirectToPublished = draftTargets.includes('published');

  if (goesDirectToPublished) {
    return {
      pass: false,
      code: 'PWS007',
      message: 'Draft state transitions directly to "published" without a review step',
      detail: [
        'Add a "review" or "approval" intermediate state.',
        'If direct publishing is intentional, set allowDirectPublish:true in the spec.',
      ].join('\n'),
    };
  }

  return {
    pass: true,
    code: 'PWS007',
    message: 'Draft does not bypass review — workflow enforces approval gate',
  };
}
