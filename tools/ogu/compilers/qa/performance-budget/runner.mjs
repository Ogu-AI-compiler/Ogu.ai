import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * performance-budget runner
 * Executes all QA030–QA037 gates sequentially.
 * Produces: performance-budget-artifact.json
 */

const GATES = [
  'spec-valid',
  'no-fid-metric',
  'cls-is-decimal',
  'lcp-threshold-realistic',
  'ci-action-enforced',
  'lighthouse-runs-sufficient',
  'no-todos',
  'contract-performance',
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

  // Read spec for artifact payload
  let spec = {};
  try { spec = JSON.parse(readFileSync(join(dir, 'performance-budget-spec.json'), 'utf8')); }
  catch { /* spec may not exist yet — gates already caught this */ }

  const project = spec.project ?? 'default';
  const timestamp = new Date().toISOString();
  const attestation = {
    hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
    timestamp,
  };

  const artifact = {
    ir_id: `PERFORMANCE_BUDGET:${project}`,
    project,
    ciAction: spec.ciAction ?? null,
    coreWebVitals: spec.coreWebVitals ?? null,
    lighthouseThresholds: spec.lighthouseThresholds ?? null,
    lighthouseRuns: spec.lighthouseRuns ?? spec.numberOfRuns ?? spec.lighthouse?.runs ?? null,
    gates: results,
    pass: allPass,
    attestation,
  };

  writeFileSync(join(dir, 'performance-budget-artifact.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}
