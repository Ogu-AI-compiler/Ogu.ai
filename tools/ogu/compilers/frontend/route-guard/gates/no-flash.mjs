import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'RG005', message: 'No guard component file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Anti-pattern: rendering children before auth is resolved
  // e.g.: if (!user) { redirect } return <>{children}</> — fine
  // Flash: return <>{children}</> at top before auth check
  const lines = content.split('\n');

  // Find where children is first rendered vs where auth check happens
  const childrenRenderLine = lines.findIndex(l => /\{children\}|Outlet\s*\/>/.test(l));
  const authCheckLine = lines.findIndex(l => /isAuthenticated|isLoggedIn|!user\b|user\s*===\s*null/.test(l));

  if (childrenRenderLine !== -1 && authCheckLine !== -1 && childrenRenderLine < authCheckLine) {
    return {
      pass: false, code: 'RG005',
      message: 'Flash of protected content — {children} rendered before auth check',
      detail: `children rendered on line ~${childrenRenderLine + 1}, auth check on line ~${authCheckLine + 1}. Auth check must come first.`
    };
  }

  // Check for isLoading guard
  const hasLoadingGuard = /isLoading|isPending|status.*loading/.test(content);
  if (!hasLoadingGuard) {
    return {
      pass: false, code: 'RG005',
      message: 'No isLoading check — during auth resolution, children may flash before redirect',
      detail: 'Add: if (isLoading) return <LoadingSpinner /> before the auth check'
    };
  }

  return { pass: true, code: 'RG005', message: 'No flash — auth resolves before children render' };
}
