import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
const RULES = [
  { id: 'sanitizer-imported', description: 'DOMPurify or sanitizeHtml must be imported', test: c => /import.*DOMPurify|import.*sanitizeHtml|require.*dompurify|require.*sanitize-html/.test(c) },
  { id: 'no-raw-html', description: 'No dangerouslySetInnerHTML without sanitize', test: c => !/__html\s*:\s*(?!.*sanitize|.*DOMPurify).*[^}]+}/.test(c) },
  { id: 'exported-component', description: 'Component must be exported', test: c => /export\s+(default\s+|function\s+|const\s+)/.test(c) },
];
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'SH009', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));
  if (violations.length) return { pass: false, code: 'SH009', message: `Contract violations: ${violations.map(v => v.id).join(', ')}`, detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n') };
  return { pass: true, code: 'SH009', message: 'All safe-html contract rules passed' };
}
