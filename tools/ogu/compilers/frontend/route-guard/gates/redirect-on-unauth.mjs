import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'guard-spec.json'), 'utf8'));
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'RG004', message: 'No guard component file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Must redirect when not authenticated
  const hasRedirect = /navigate\s*\(|<Navigate|redirect\s*\(|router\.push/.test(content);
  const hasAuthCheck = /isAuthenticated|isLoggedIn|user\s*===\s*null|!user\b|!isAuth/.test(content);

  if (!hasRedirect) {
    return { pass: false, code: 'RG004', message: 'No navigation/redirect found — guard must redirect unauthenticated users', detail: `Add: if (!isAuthenticated) return <Navigate to="${spec.redirectTo}" replace />` };
  }

  if (!hasAuthCheck) {
    return { pass: false, code: 'RG004', message: 'No auth check found — guard must verify auth state before rendering children' };
  }

  // Check redirect target matches spec
  if (!content.includes(spec.redirectTo) && !content.includes(spec.redirectTo.replace('/', ''))) {
    return { pass: false, code: 'RG004', message: `Guard redirects somewhere other than spec.redirectTo ('${spec.redirectTo}')` };
  }

  return { pass: true, code: 'RG004', message: `Redirect-on-unauth present → ${spec.redirectTo}` };
}
