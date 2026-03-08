import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTRACT_RULES = [
  {
    id: 'lazy-top-level',
    description: 'Top-level route components must use React.lazy for code splitting',
    test: (content) => /lazy\s*\(/.test(content) || /dynamic\s*\(/.test(content)
  },
  {
    id: 'suspense-boundary',
    description: 'Router must wrap lazy routes in <Suspense fallback={...}>',
    test: (content) => /Suspense/.test(content) || /fallback=/.test(content)
  },
  {
    id: 'no-string-navigation',
    description: 'Prefer typed navigation (useNavigate with typed routes) over string literals for protected paths',
    test: (content) => {
      // Soft check: warn if many hardcoded string navigations
      const hardcoded = (content.match(/navigate\s*\(['"][^'"]+['"]\)/g) || []).length;
      return hardcoded < 5; // allow some, flag excessive
    }
  },
  {
    id: 'error-element',
    description: 'Router should have error boundary — errorElement or ErrorBoundary',
    test: (content) => /errorElement|ErrorBoundary|error-boundary/.test(content)
  },
  {
    id: 'not-found-route',
    description: 'A catch-all or 404 route must exist',
    test: (content) => /path.*\*|NotFound|404|not-found/.test(content)
  }
];

export async function run({ dir }) {
  const routeFiles = readdirSync(dir).filter(f =>
    (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts')
  );

  if (!routeFiles.length) {
    return { pass: false, code: 'RC012', message: 'No route config file found for contract check' };
  }

  const content = routeFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = CONTRACT_RULES.filter(rule => !rule.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'RC012',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'RC012', message: 'All routing contract rules passed' };
}
