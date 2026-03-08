import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const KNOWN_PROVIDERS = ['QueryClientProvider', 'BrowserRouter', 'RouterProvider', 'Provider', 'ThemeProvider', 'AuthProvider', 'ToastProvider', 'ErrorBoundary'];

export async function run({ dir }) {
  const specPath = join(dir, 'providers-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'PR001', message: 'providers-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'PR001', message: `Invalid JSON: ${e.message}` }; }

  if (!spec.providers || !Array.isArray(spec.providers) || !spec.providers.length) {
    return { pass: false, code: 'PR001', message: 'spec.providers must be a non-empty array (ordered outermost → innermost)' };
  }

  return { pass: true, code: 'PR001', message: `Spec valid — ${spec.providers.length} providers: [${spec.providers.join(', ')}]` };
}
