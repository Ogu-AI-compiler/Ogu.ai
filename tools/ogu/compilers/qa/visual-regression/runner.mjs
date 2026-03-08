import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * visual-regression runner
 * Executes all QA060–QA066 gates sequentially.
 * Produces: visual-regression-artifact.json
 */

const GATES = [
  'spec-valid',
  'threshold-realistic',
  'mobile-viewport-present',
  'approval-workflow-defined',
  'storybook-build-dir-declared',
  'no-todos',
  'contract-visual',
];

export async function run({ dir, projectRoot, verbose = false }) {
  const results = [];
  let allPass = true;

  for (const name of GATES) {
    const { run: gate } = await import(`./gates/${name}.mjs`);
    const result = await gate({ dir, projectRoot: projectRoot ?? dir });
    results.push(result);
    if (!result.pass && !result.skipped) allPass = false;
    if (verbose) {
      const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
      console.log(`  ${icon} ${result.code}: ${result.message}`);
    }
  }

  let spec = {};
  try { spec = JSON.parse(readFileSync(join(dir, 'visual-regression-spec.json'), 'utf8')); }
  catch { /* gates already caught this */ }

  const project = spec.project ?? 'default';
  const timestamp = new Date().toISOString();
  const attestation = {
    hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
    timestamp,
  };

  const artifact = {
    ir_id: `VISUAL_REGRESSION:${project}`,
    project,
    tool: spec.tool ?? null,
    viewports: spec.viewports ?? [],
    diffThreshold: spec.diffThreshold ?? null,
    stories: spec.stories ?? [],
    routes: spec.routes ?? [],
    approvalWorkflow: spec.approvalWorkflow ?? null,
    storybookBuildDir: spec.storybookBuildDir ?? null,
    gates: results,
    pass: allPass,
    attestation,
  };

  writeFileSync(join(dir, 'visual-regression-artifact.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}
