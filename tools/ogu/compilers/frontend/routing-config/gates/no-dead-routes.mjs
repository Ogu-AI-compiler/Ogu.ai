import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function flattenRoutes(routes, parentPath = '') {
  const flat = [];
  for (const route of routes) {
    const fullPath = route.path ? (parentPath + '/' + route.path).replace(/\/+/g, '/') : parentPath;
    if (route.component) flat.push({ path: fullPath, component: route.component });
    if (route.children) flat.push(...flattenRoutes(route.children, fullPath));
  }
  return flat;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'routing-spec.json'), 'utf8'));
  const allRoutes = flattenRoutes(spec.routes);

  // Find route config files
  const routeFiles = readdirSync(dir).filter(f =>
    (f.includes('route') || f.includes('Route') || f.includes('router') || f.includes('Router')) &&
    (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts')
  );

  if (!routeFiles.length) {
    return { pass: true, code: 'RC004', message: 'No route config file found — static analysis skipped', skipped: true };
  }

  const content = routeFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check each static route path appears in the file
  const staticRoutes = allRoutes.filter(r => !r.path.includes(':'));
  const dead = staticRoutes.filter(r => {
    const pathStr = r.path.replace(/^\//, '');
    return pathStr && !content.includes(`'${r.path}'`) && !content.includes(`"${r.path}"`);
  });

  if (dead.length) {
    return {
      pass: false, code: 'RC004',
      message: `Potential dead routes (paths in spec but not in route file): ${dead.length}`,
      detail: dead.map(r => r.path).join('\n')
    };
  }

  return { pass: true, code: 'RC004', message: `No dead routes — ${allRoutes.length} routes checked` };
}
