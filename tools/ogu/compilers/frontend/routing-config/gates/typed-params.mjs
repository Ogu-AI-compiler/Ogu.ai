import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'routing-spec.json'), 'utf8'));

  // Collect all paths with params
  function collectParamRoutes(routes) {
    const result = [];
    for (const route of routes) {
      if (route.path && route.path.includes(':')) {
        const params = route.path.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];
        result.push({ path: route.path, params, component: route.component });
      }
      if (route.children) result.push(...collectParamRoutes(route.children));
    }
    return result;
  }

  const paramRoutes = collectParamRoutes(spec.routes);

  if (!paramRoutes.length) {
    return { pass: true, code: 'RC007', message: 'No parameterized routes — skipping typed params check', skipped: true };
  }

  // Check that route config or types file defines param types
  const allFiles = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts'));
  const content = allFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const violations = [];

  for (const { path, params } of paramRoutes) {
    for (const param of params) {
      // Check for type definition of this param
      const hasTypedParam = new RegExp(`${param}\\s*:\\s*string`).test(content) ||
                            new RegExp(`Params.*${param}|${param}.*Params`).test(content) ||
                            // TanStack Router typed params
                            new RegExp(`params.*${param}`).test(content);

      if (!hasTypedParam) {
        violations.push(`Route '${path}': param ':${param}' has no TypeScript type definition`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RC007',
      message: `Untyped path params (${violations.length})`,
      detail: violations.join('\n') + '\nDefine: type RouteParams = { ' + paramRoutes[0]?.params.map(p => `${p}: string`).join('; ') + ' }'
    };
  }

  return {
    pass: true, code: 'RC007',
    message: `All path params typed — ${paramRoutes.length} parameterized routes checked`
  };
}
