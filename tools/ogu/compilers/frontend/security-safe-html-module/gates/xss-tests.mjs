import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx') || f.endsWith('.spec.ts'));
  if (!testFiles.length) return { pass: false, code: 'SH006', message: 'No test file found — XSS tests required' };
  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const hasXssPayload = /<script>|javascript:|onerror=|onload=|xss|XSS|alert\(1\)|img src=x/.test(content);
  if (!hasXssPayload) return { pass: false, code: 'SH006', message: 'No XSS attack vector tests found', detail: 'Add tests with <script>, javascript:, onerror= payloads to verify sanitization' };
  return { pass: true, code: 'SH006', message: 'XSS attack vector tests present' };
}
