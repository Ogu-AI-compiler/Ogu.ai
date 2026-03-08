import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'routing-spec.json'), 'utf8'));

  // Find routes that are marked as protected
  function collectProtectedRoutes(routes) {
    const result = [];
    for (const route of routes) {
      if (route.auth === true || route.protected === true || route.requiresAuth === true) {
        result.push(route.path);
      }
      if (route.children) result.push(...collectProtectedRoutes(route.children));
    }
    return result;
  }

  const protectedRoutes = collectProtectedRoutes(spec.routes);

  if (!protectedRoutes.length) {
    return { pass: true, code: 'RC011', message: 'No protected routes — skipping guard check', skipped: true };
  }

  // Find route config files
  const routeFiles = readdirSync(dir).filter(f =>
    (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts')
  );

  if (!routeFiles.length) {
    return { pass: false, code: 'RC011', message: 'Route config file not found — cannot verify auth guards' };
  }

  const content = routeFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check for auth guard component/wrapper
  const hasAuthGuard = /ProtectedRoute|AuthGuard|RequireAuth|PrivateRoute|withAuth/.test(content) ||
                       /useAuth.*navigate|isAuthenticated.*redirect/.test(content);

  if (!hasAuthGuard) {
    return {
      pass: false, code: 'RC011',
      message: `${protectedRoutes.length} protected routes found but no auth guard component detected`,
      detail: `Protected routes: ${protectedRoutes.join(', ')}\nAdd: <ProtectedRoute> wrapper or <RequireAuth> component`
    };
  }

  return { pass: true, code: 'RC011', message: `Auth guard present for ${protectedRoutes.length} protected routes` };
}
