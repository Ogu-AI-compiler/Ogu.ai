import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * OR006 — no-network-calls
 * Repositories must not make external network calls.
 * They access the database only. HTTP calls belong in service-client-module.
 */

const NETWORK_PATTERNS = [
  /\bfetch\s*\(/,
  /axios\.(get|post|put|patch|delete)\s*\(/,
  /http\.request\s*\(/,
  /https\.request\s*\(/,
  /got\s*\(/,
  /superagent\./,
  /needle\./,
  /request\s*\(\s*['"]https?:/,
];

function getRepoFiles(dir) {
  const results = [];
  function walk(d) {
    let e; try { e = readdirSync(d,{withFileTypes:true}); } catch { return; }
    for (const f of e) { if (f.isDirectory()) { if (['node_modules','dist','.git'].includes(f.name)) continue; walk(join(d,f.name)); } else if (f.name.endsWith('.ts') && !f.name.includes('.test.') && !f.name.includes('.spec.') && (f.name.includes('.repo.') || f.name.toLowerCase().includes('repository'))) results.push(join(d,f.name)); }
  }
  walk(dir); return results;
}

export async function run({ dir }) {
  const repoFiles = getRepoFiles(dir);
  if (repoFiles.length === 0) {
    return { pass: true, code: 'OR006', message: 'No repository files found — gate skipped', skipped: true };
  }

  const violations = [];
  for (const file of repoFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      if (NETWORK_PATTERNS.some(p => p.test(line))) {
        violations.push(`${file.replace(dir+'/','')}: ${i+1} — network call in repository: ${line.trim().slice(0,80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'OR006',
      message: `${violations.length} network call(s) found in repository`,
      detail: violations.join('\n') + '\n\nRepositories only access the database. Move HTTP calls to service-client-module.'
    };
  }

  return { pass: true, code: 'OR006', message: 'No external network calls in repository files' };
}
