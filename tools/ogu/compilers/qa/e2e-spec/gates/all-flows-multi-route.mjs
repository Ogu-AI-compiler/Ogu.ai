import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA022 — all-flows-multi-route
 * Every user flow must cover at least 2 routes.
 *
 * A flow that covers only one route is a component test or unit test —
 * not an E2E test. E2E tests verify the journey across pages, not
 * a single page's behaviour. Naming something a "flow" when it only
 * visits one page creates a false sense of E2E coverage.
 *
 * Exception: flows marked singlePage: true (rare — document why).
 */

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'e2e-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA022', message: 'e2e-spec.json not readable' };
  }

  const violations = [];
  for (const flow of (spec.userFlows || [])) {
    if (flow.singlePage === true) continue; // explicit exception
    const routes = flow.routesCovered || [];
    if (routes.length < 2) {
      violations.push(
        `Flow "${flow.id}" (${flow.name}) covers only ${routes.length} route(s): [${routes.join(', ')}] — add at least one more route or mark singlePage: true`
      );
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA022',
      message: `${violations.length} flow(s) cover only one route`,
      detail: violations.join('\n'),
    };
  }

  const totalRoutes = (spec.userFlows || []).reduce((sum, f) => sum + (f.routesCovered || []).length, 0);
  return {
    pass: true, code: 'QA022',
    message: `All ${(spec.userFlows || []).length} flow(s) cover ≥2 routes (${totalRoutes} total route references)`,
  };
}
