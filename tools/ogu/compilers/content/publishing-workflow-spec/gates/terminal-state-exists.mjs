import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PWS005 — terminal-state-exists: workflow must have at least one terminal state (published or archived) */
export async function run({ dir }) {
  const specPath = join(dir, 'publishing-workflow-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'PWS005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PWS005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.states) || spec.states.length === 0) {
    return { pass: true, code: 'PWS005', message: 'No states defined — gate skipped', skipped: true };
  }

  // A terminal state is one explicitly marked terminal:true, or "published"/"archived" by convention
  const terminalIds = ['published', 'archived', 'live', 'removed'];
  const terminalStates = spec.states.filter(s =>
    s.terminal === true || terminalIds.includes(s.id)
  );

  if (terminalStates.length === 0) {
    return {
      pass: false,
      code: 'PWS005',
      message: 'No terminal state found in workflow',
      detail: `Mark a state with terminal:true or use a conventional terminal ID: ${terminalIds.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'PWS005',
    message: `Terminal state(s) found: ${terminalStates.map(s => s.id).join(', ')}`,
  };
}
