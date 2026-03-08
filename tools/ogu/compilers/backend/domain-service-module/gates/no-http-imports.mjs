import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const HTTP_PATTERNS = [/from ['"]express['"]/,/from ['"]fastify['"]/,/from ['"]hapi['"]/,/from ['"]koa['"]/,/NextFunction/,/FastifyRequest/,/FastifyReply/,/\bRequest\b.*from/,/\bResponse\b.*from/];
function getServiceFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.service\.ts$/) && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const serviceFiles = getServiceFiles(dir);
  if (serviceFiles.length === 0) {
    return { pass: true, code: 'DS004', message: 'No service files found — HTTP imports gate skipped', skipped: true };
  }

  const violations = [];
  for (const file of serviceFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!line.trim().startsWith('//') && HTTP_PATTERNS.some(p => p.test(line))) {
        violations.push(`${file.replace(dir + '/', '')}: ${i + 1} — HTTP import in service: ${line.trim().slice(0, 80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DS004',
      message: `${violations.length} HTTP framework import(s) in service`,
      detail: violations.join('\n') + '\n\nServices are framework-agnostic. Remove all express/fastify imports.'
    };
  }
  return { pass: true, code: 'DS004', message: `No HTTP framework imports in service files (${serviceFiles.length} file(s))` };
}
