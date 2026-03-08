import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * load-test-spec runner
 * Executes all QA040–QA049 gates sequentially.
 * Produces: load-test-artifact.json
 */

const GATES = [
  'spec-valid',
  'tool-declared',
  'smoke-required',
  'thresholds-per-scenario',
  'error-rate-defined',
  'staging-only-for-stress',
  'output-artifacts-defined',
  'baseline-comparison',
  'no-todos',
  'contract-load-test',
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
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { /* gates already caught this */ }

  const project = spec.project ?? 'default';
  const timestamp = new Date().toISOString();
  const attestation = {
    hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
    timestamp,
  };

  const artifact = {
    ir_id: `LOAD_TEST_SPEC:${project}`,
    project,
    tool: spec.tool ?? null,
    targetEnvironment: spec.targetEnvironment ?? null,
    scenarios: spec.scenarios ?? [],
    outputArtifacts: spec.outputArtifacts ?? null,
    baseline: spec.baseline ?? null,
    gates: results,
    pass: allPass,
    attestation,
  };

  writeFileSync(join(dir, 'load-test-artifact.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}
