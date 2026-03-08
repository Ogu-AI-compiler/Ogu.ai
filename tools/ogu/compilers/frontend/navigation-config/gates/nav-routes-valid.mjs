import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir, projectRoot }) {
  const specPath = join(dir, 'nav-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'NC004', message: 'nav-spec.json not found' };

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const navPaths = (spec.items || []).map(i => i.path).filter(Boolean);

  // Try to find routing config in the same dir or project root
  const root = projectRoot || dir;
  const routingFiles = [];
  const searchDirs = [dir, root];
  for (const d of searchDirs) {
    try {
      readdirSync(d).filter(f => /router|routes|routing/i.test(f) && (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx'))).forEach(f => routingFiles.push(join(d, f)));
    } catch { /* skip */ }
  }

  if (!routingFiles.length) {
    // No routing file found — check nav-spec paths are at least valid path format
    const malformed = navPaths.filter(p => !p.startsWith('/') && p !== '#');
    if (malformed.length) {
      return { pass: false, code: 'NC004', message: `Nav paths must start with /: ${malformed.join(', ')}` };
    }
    return { pass: true, code: 'NC004', message: `Path format valid — ${navPaths.length} paths (routing file not found for deep check)` };
  }

  const routingContent = routingFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const unregistered = navPaths.filter(p => p !== '#' && !routingContent.includes(`"${p}"`) && !routingContent.includes(`'${p}'`));

  if (unregistered.length) {
    return {
      pass: false, code: 'NC004',
      message: `${unregistered.length} nav path(s) not found in routing config`,
      detail: unregistered.map(p => `  "${p}" — not registered`).join('\n')
    };
  }

  return { pass: true, code: 'NC004', message: `All ${navPaths.length} nav paths are registered routes` };
}
