/**
 * Gate: golden-paths-defined (DP003)
 * Validates that at least one golden path is defined. Golden paths are the
 * opinionated, pre-built developer workflows (e.g., "create new service",
 * "deploy to production") that a developer platform provides. Without them,
 * the platform is a collection of tools without a unified developer experience.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'dev-platform-spec.json'), 'utf8'));

  if (spec.skipGoldenPaths) {
    return { pass: true, code: 'DP003', message: 'skipGoldenPaths=true — check skipped', skipped: true };
  }

  if (!spec.goldenPaths || spec.goldenPaths.length === 0) {
    return {
      pass: false, code: 'DP003',
      message: 'No golden paths defined — developer platform must provide at least one opinionated developer workflow',
      detail: {
        hint:    'Add goldenPaths: [{ name, steps: [...] }] or set skipGoldenPaths: true for exemption',
        example: '{ name: "create-service", steps: ["scaffold", "configure-ci", "deploy-to-staging"] }',
      },
    };
  }

  const violations = [];
  for (const gp of spec.goldenPaths) {
    if (!gp.name)                                   violations.push({ path: '(unnamed)', reason: 'Golden path is missing a name field' });
    if (!gp.steps || gp.steps.length === 0)         violations.push({ path: gp.name || '(unnamed)', reason: 'Golden path has no steps defined — it cannot guide developers through any workflow' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP003',
      message: `${violations.length} golden path issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DP003', message: `${spec.goldenPaths.length} golden path(s) defined` };
}
