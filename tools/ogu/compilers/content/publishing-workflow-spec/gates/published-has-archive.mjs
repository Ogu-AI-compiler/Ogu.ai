import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PWS003 — published-has-archive: the "published" state must have a transition to an archive/unpublished state */
export async function run({ dir }) {
  const specPath = join(dir, 'publishing-workflow-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'PWS003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PWS003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.states) || spec.states.length === 0) {
    return { pass: true, code: 'PWS003', message: 'No states defined — gate skipped', skipped: true };
  }

  const publishedState = spec.states.find(s => s.id === 'published');

  if (!publishedState) {
    // states-complete gate handles this case
    return { pass: true, code: 'PWS003', message: 'No "published" state — gate skipped', skipped: true };
  }

  const transitions = publishedState.transitions || {};
  const transitionTargets = Object.values(transitions);

  // Check for any archive/unpublish transition target
  const archiveKeywords = ['archive', 'archived', 'unpublish', 'unpublished', 'retired', 'removed'];
  const hasArchiveTransition = transitionTargets.some(target =>
    archiveKeywords.some(kw => target.toLowerCase().includes(kw))
  );

  if (!hasArchiveTransition) {
    return {
      pass: false,
      code: 'PWS003',
      message: 'The "published" state has no archive/unpublish transition',
      detail: `Current transitions: ${JSON.stringify(transitions)}\nAdd a transition to "archived" or "unpublished" state.`,
    };
  }

  return {
    pass: true,
    code: 'PWS003',
    message: 'Published state has an archive/unpublish transition',
  };
}
