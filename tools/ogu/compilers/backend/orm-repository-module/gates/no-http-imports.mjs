import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * OR005 — no-http-imports
 * Repository must not import HTTP framework types.
 * Repositories are pure data access — they know nothing about HTTP.
 */

const HTTP_IMPORT_PATTERNS = [
  /from ['"]express['"]/,
  /from ['"]fastify['"]/,
  /from ['"]hapi['"]/,
  /from ['"]@hapi/,
  /from ['"]koa['"]/,
  /Request\s*[,;>}]/,    // Express Request type (but not "request" strings)
  /Response\s*[,;>}]/,   // Express Response type
  /NextFunction/,
  /FastifyRequest/,
  /FastifyReply/,
];

function getAllTsFiles(dir) {
  const results = [];
  function walk(d) {
    let e; try { e = readdirSync(d,{withFileTypes:true}); } catch { return; }
    for (const f of e) { if (f.isDirectory()) { if (['node_modules','dist','.git','.test.'].includes(f.name)) continue; walk(join(d,f.name)); } else if (f.name.endsWith('.ts') && !f.name.includes('.test.') && !f.name.includes('.spec.')) results.push(join(d,f.name)); }
  }
  walk(dir); return results;
}

export async function run({ dir }) {
  const violations = [];

  for (const file of getAllTsFiles(dir)) {
    // Only check if this looks like a repository file
    if (!file.includes('.repo.') && !file.toLowerCase().includes('repository')) continue;

    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      if (HTTP_IMPORT_PATTERNS.some(p => p.test(line))) {
        violations.push(`${file.replace(dir+'/','')}: ${i+1} — HTTP framework import in repository: ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'OR005',
      message: `${violations.length} HTTP framework import(s) found in repository`,
      detail: violations.join('\n') + '\n\nRepositories must be framework-agnostic. Remove all express/fastify imports.'
    };
  }

  return { pass: true, code: 'OR005', message: 'No HTTP framework imports in repository files' };
}
