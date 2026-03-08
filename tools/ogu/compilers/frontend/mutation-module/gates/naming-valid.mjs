import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'mutation-spec.json'), 'utf8'));
  const hookName = spec.hookName;

  if (!hookName.startsWith('use')) {
    return { pass: false, code: 'MU002', message: `Hook name must start with 'use'. Got: ${hookName}` };
  }

  if (!hookName.endsWith('Mutation')) {
    return {
      pass: false, code: 'MU002',
      message: `Mutation hook names must end with 'Mutation' for discoverability. Got: ${hookName}. Expected: ${hookName}Mutation`
    };
  }

  // Find the hook file
  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
  if (!hookFiles.length) {
    return { pass: false, code: 'MU002', message: 'No hook file found (expected useXxxMutation.ts)' };
  }

  return { pass: true, code: 'MU002', message: `Hook name valid: ${hookName}` };
}
