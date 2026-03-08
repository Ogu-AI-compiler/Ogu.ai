import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'SH005', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasHref = /href\s*=/.test(content);
  const hasSrc = /src\s*=/.test(content);
  if (!hasHref && !hasSrc) return { pass: true, code: 'SH005', message: 'No href/src bindings — allowlist not required', skipped: true };

  const hasAllowlist = /ALLOWED_URL|SAFE_ORIGINS|allowedDomains|isAllowedUrl|validateUrl|allowlist/i.test(content);
  const hasJavascriptProto = /href\s*=\s*['"]\s*javascript:/i.test(content);

  if (hasJavascriptProto) return { pass: false, code: 'SH005', message: 'javascript: protocol used in href', detail: 'Never bind user-controlled values to href without stripping javascript: prefix' };
  if ((hasHref || hasSrc) && !hasAllowlist) return { pass: false, code: 'SH005', message: 'href/src bindings without URL allowlist validation', detail: 'Add ALLOWED_ORIGINS allowlist or isAllowedUrl() guard before binding URLs' };
  return { pass: true, code: 'SH005', message: 'URL allowlist validation present' };
}
