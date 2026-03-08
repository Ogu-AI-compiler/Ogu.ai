import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'routing-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'RC001', message: 'routing-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'RC001', message: `Invalid JSON: ${e.message}` };
  }

  if (!spec.routes || !Array.isArray(spec.routes) || !spec.routes.length) {
    return { pass: false, code: 'RC001', message: 'routes must be a non-empty array' };
  }

  const routeErrors = [];
  for (const route of spec.routes) {
    if (!route.path) routeErrors.push(`Route missing 'path': ${JSON.stringify(route)}`);
    if (!route.component && !route.redirect && !route.children) {
      routeErrors.push(`Route '${route.path}' missing 'component', 'redirect', or 'children'`);
    }
  }

  if (routeErrors.length) {
    return { pass: false, code: 'RC001', message: 'Route definition errors', detail: routeErrors.join('\n') };
  }

  // Validate router type
  const validTypes = ['react-router-v6', 'next-app-router', 'next-pages-router', 'tanstack-router'];
  if (spec.type && !validTypes.includes(spec.type)) {
    return { pass: false, code: 'RC001', message: `Unknown router type: ${spec.type}. Valid: ${validTypes.join(', ')}` };
  }

  return { pass: true, code: 'RC001', message: `Spec valid — ${spec.routes.length} routes, type: ${spec.type || 'react-router-v6'}` };
}
