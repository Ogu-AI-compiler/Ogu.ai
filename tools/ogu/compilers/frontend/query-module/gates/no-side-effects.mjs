import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const hookFiles = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && f.startsWith('use'));
  if (!hookFiles.length) {
    return { pass: false, code: 'QM007', message: 'No hook file found' };
  }

  const content = readFileSync(join(dir, hookFiles[0]), 'utf8');

  // Extract the queryFn body — look for queryFn: async () => { ... } or similar
  const queryFnMatch = content.match(/queryFn\s*:\s*(?:async\s*)?\(?.*?\)?\s*=>\s*\{([\s\S]*?)\}/);
  const toAnalyze = queryFnMatch ? queryFnMatch[1] : content;

  const violations = [];
  const lines = toAnalyze.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Mutation methods inside a query fetcher
    if (/\bfetch\s*\(.*['"](?:POST|PUT|PATCH|DELETE)['"]/.test(line)) {
      violations.push(`Line ${i + 1}: mutation method in query fetcher — ${trimmed}`);
    }
    if (/\baxios\.(post|put|patch|delete)\b/.test(line)) {
      violations.push(`Line ${i + 1}: axios mutation inside query fetcher — ${trimmed}`);
    }
    // localStorage/sessionStorage writes in queryFn
    if (/localStorage\.setItem|sessionStorage\.setItem/.test(line)) {
      violations.push(`Line ${i + 1}: storage write in queryFn — ${trimmed}`);
    }
    // Direct DOM manipulation
    if (/document\.(getElementById|querySelector|createElement).*=(?!=)/.test(line)) {
      violations.push(`Line ${i + 1}: DOM write in queryFn — ${trimmed}`);
    }
  });

  if (violations.length) {
    return {
      pass: false, code: 'QM007',
      message: `Side effects found in query fetcher (${violations.length})`,
      detail: violations.slice(0, 5).join('\n')
    };
  }

  return { pass: true, code: 'QM007', message: 'No mutation side-effects in query fetcher' };
}
