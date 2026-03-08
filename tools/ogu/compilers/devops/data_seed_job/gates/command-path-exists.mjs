/**
 * Gate: command-path-exists (DS002)
 * Validates that a command is declared and, if a scriptPath is referenced,
 * that the script file exists relative to the compiler directory. A missing
 * script at deploy time causes the seed job to fail immediately on startup.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'data-seed-spec.json'), 'utf8'));

  if (!spec.command) {
    return {
      pass: false, code: 'DS002',
      message: 'No command specified in data-seed-spec.json',
      detail: { hint: 'Add a command field (e.g., "node scripts/seed.js") that the seed job will execute' },
    };
  }

  if (spec.scriptPath) {
    const scriptAbs = join(dir, spec.scriptPath);
    if (!existsSync(scriptAbs)) {
      return {
        pass: false, code: 'DS002',
        message: `Seed script not found: ${spec.scriptPath}`,
        detail: { searched: scriptAbs, hint: 'Ensure the script exists at the declared path relative to the compiler directory' },
      };
    }
  }

  return { pass: true, code: 'DS002', message: `Seed command: ${spec.command}` };
}
