import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'routing-spec.json'), 'utf8'));

  if (!spec.pageArtifacts || !spec.pageArtifacts.length) {
    return { pass: true, code: 'RC010', message: 'No pageArtifacts in spec — skipping cross-page check', skipped: true };
  }

  const violations = [];

  for (const artifactRef of spec.pageArtifacts) {
    const artifactPath = resolve(dir, artifactRef);
    if (!existsSync(artifactPath)) {
      violations.push(`page-artifact not found: ${artifactPath} — compile react-page first`);
      continue;
    }

    const pageArtifact = JSON.parse(readFileSync(artifactPath, 'utf8'));

    // Check that a route exists for this page
    function findRoute(routes, pageName) {
      for (const route of routes) {
        if (route.component === pageName || route.component?.includes(pageName)) return true;
        if (route.children && findRoute(route.children, pageName)) return true;
      }
      return false;
    }

    const pageName = pageArtifact.page_name || pageArtifact.component_name;
    if (pageName && !findRoute(spec.routes, pageName)) {
      violations.push(`Page '${pageName}' has a page-artifact but no matching route entry`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'RC010', message: 'Unrouted pages found', detail: violations.join('\n') };
  }

  return { pass: true, code: 'RC010', message: `All ${spec.pageArtifacts.length} page artifacts have matching routes` };
}
