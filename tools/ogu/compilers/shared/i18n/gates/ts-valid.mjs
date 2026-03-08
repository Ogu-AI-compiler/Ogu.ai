import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const tsconfig = existsSync(join(root, 'tsconfig.json')) ? join(root, 'tsconfig.json') : null;

  try {
    const cmd = tsconfig
      ? `npx tsc --noEmit --project "${tsconfig}" 2>&1`
      : `npx tsc --noEmit --strict --target ES2020 --module ESNext --moduleResolution bundler --jsx react-jsx "${dir}/**/*.ts" "${dir}/**/*.tsx" 2>&1`;
    execSync(cmd, { cwd: root, stdio: 'pipe' });
    return { pass: true, code: 'I1002', message: 'TypeScript compilation passed' };
  } catch (e) {
    const output = e.stdout?.toString() || e.message;
    const errors = output.split('\n').filter(l => l.includes('error TS')).slice(0, 5);
    return { pass: false, code: 'I1002', message: 'TypeScript errors found', detail: errors.join('\n') };
  }
}
