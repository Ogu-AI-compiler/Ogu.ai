import { execFileSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findServiceFile(dir) {
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return null; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(f.name)) continue;
        const r = walk(join(d, f.name));
        if (r) return r;
      } else if (
        (f.name.match(/\.service\.ts$/) || f.name.match(/[Ss]ervice\.ts$/)) &&
        !f.name.includes('.test.')
      ) {
        return join(d, f.name);
      }
    }
    return null;
  }
  return walk(dir);
}

export async function run({ dir, projectRoot }) {
  const serviceFile = findServiceFile(dir);
  if (!serviceFile) {
    return { pass: false, code: 'DS002', message: 'Service .ts file not found (expected *.service.ts)' };
  }
  const root = projectRoot || dir;
  try {
    const args = ['tsc', '--noEmit', '--skipLibCheck'];
    if (existsSync(join(root, 'tsconfig.json'))) args.push('--project', join(root, 'tsconfig.json'));
    else args.push(serviceFile);
    execFileSync('npx', args, { cwd: root, encoding: 'utf8', maxBuffer: 5*1024*1024, stdio: ['pipe','pipe','pipe'] });
    return { pass: true, code: 'DS002', message: `TypeScript valid: ${serviceFile.replace(dir+'/','')}`};
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    const relevant = output.split('\n').filter(l => l.includes(dir)).slice(0,20).join('\n');
    return { pass: false, code: 'DS002', message: 'TypeScript compilation failed', detail: relevant || output.slice(-2000) };
  }
}
