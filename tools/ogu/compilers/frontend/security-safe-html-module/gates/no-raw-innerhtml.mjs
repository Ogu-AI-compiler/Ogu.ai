import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'SH004', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasRawDangerously = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:(?!\s*sanitize|\s*DOMPurify|\s*sanitizeHtml)/.test(content);
  const hasInnerHTML = /\.innerHTML\s*=(?!\s*(?:sanitize|DOMPurify|sanitizeHtml))/.test(content);

  if (hasRawDangerously) return { pass: false, code: 'SH004', message: 'dangerouslySetInnerHTML used without sanitization', detail: 'Wrap with DOMPurify.sanitize() or sanitizeHtml() before passing to __html' };
  if (hasInnerHTML) return { pass: false, code: 'SH004', message: '.innerHTML assignment without sanitization', detail: 'Use textContent or sanitize before setting innerHTML' };
  return { pass: true, code: 'SH004', message: 'No raw innerHTML assignments' };
}
