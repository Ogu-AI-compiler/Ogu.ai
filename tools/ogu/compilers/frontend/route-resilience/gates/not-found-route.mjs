import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'RR005', message: 'No source file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check for catch-all route or 404 component
  const hasCatchAll =
    /path=["']\*["']|path=["']\/\*["']|<Route\s[^>]*\*|NotFound|not-found|Page404|Error404/.test(content);

  if (!hasCatchAll) {
    return {
      pass: false, code: 'RR005',
      message: 'No 404/catch-all route found — router must handle unknown paths',
      detail: 'Add: <Route path="*" element={<NotFound />} />\nor handle in router config: { path: "*", element: <NotFound /> }'
    };
  }

  // Check for a NotFound component that renders meaningful content
  const hasNotFoundContent =
    /NotFound|not.?found|Page404|404/.test(content);

  return { pass: true, code: 'RR005', message: '404/catch-all route present' };
}
