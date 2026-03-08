import { execFileSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findRepoFile(dir) {
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return null; }

    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
        const r = walk(join(d, e.name));
        if (r) return r;
      } else if (
        e.name.match(/\.repo\.ts$/) ||
        e.name.match(/[Rr]epository\.ts$/)
      ) {
        return join(d, e.name);
      }
    }
    return null;
  }
  return walk(dir);
}

export async function run({ dir, projectRoot }) {
  const repoFile = findRepoFile(dir);
  if (!repoFile) {
    return { pass: false, code: 'OR003', message: 'Repository .ts file not found (expected *.repo.ts or *Repository.ts)' };
  }

  const root = projectRoot || dir;
  const tsconfig = existsSync(join(root, 'tsconfig.json')) ? join(root, 'tsconfig.json') : undefined;

  try {
    const args = ['tsc', '--noEmit', '--skipLibCheck'];
    if (tsconfig) args.push('--project', tsconfig);
    else args.push(repoFile);
    execFileSync('npx', args, { cwd: root, encoding: 'utf8', maxBuffer: 5*1024*1024, stdio: ['pipe','pipe','pipe'] });
    return { pass: true, code: 'OR003', message: `TypeScript compilation passed: ${repoFile.replace(dir+'/','')}`};
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    const relevant = output.split('\n').filter(l => l.includes(dir)).slice(0, 20).join('\n');
    return { pass: false, code: 'OR003', message: 'TypeScript compilation failed', detail: relevant || output.slice(-2000) };
  }
}
