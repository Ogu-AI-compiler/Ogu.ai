import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'routing-spec.json'), 'utf8'));

  // Next.js App Router has automatic code splitting — skip
  if (spec.type === 'next-app-router' || spec.type === 'next-pages-router') {
    return { pass: true, code: 'RC006', message: 'Next.js handles lazy loading automatically — skipping', skipped: true };
  }

  const routeFiles = readdirSync(dir).filter(f =>
    (f.includes('route') || f.includes('Route') || f.includes('router') || f.includes('Router')) &&
    (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts')
  );

  if (!routeFiles.length) {
    return { pass: true, code: 'RC006', message: 'No route config file found — lazy check skipped', skipped: true };
  }

  const content = routeFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Get top-level route components (not children)
  const topLevelComponents = spec.routes
    .filter(r => r.component && !r.redirect)
    .map(r => r.component);

  if (!topLevelComponents.length) {
    return { pass: true, code: 'RC006', message: 'No top-level components to check' };
  }

  const notLazy = topLevelComponents.filter(component => {
    // Check if the component is loaded via React.lazy or dynamic import
    const lazyPattern = new RegExp(`lazy\\s*\\(.*?['"].*?${component}|import\\s*\\(.*?${component}`);
    return !lazyPattern.test(content);
  });

  if (notLazy.length) {
    return {
      pass: false, code: 'RC006',
      message: `Top-level routes not lazy-loaded: ${notLazy.join(', ')}`,
      detail: 'Wrap with React.lazy: const HomePage = lazy(() => import("./pages/HomePage"))'
    };
  }

  return { pass: true, code: 'RC006', message: `All ${topLevelComponents.length} top-level routes are lazy-loaded` };
}
