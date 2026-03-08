import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * test-data-policy runner
 * Executes all QA080–QA087 gates sequentially.
 * Produces: test-data-policy-artifact.json
 */

const GATES = [
  'spec-valid',
  'pii-forbidden',
  'snapshot-policy-defined',
  'no-shared-db-isolation',
  'deterministic-seed-defined',
  'factory-framework-specified',
  'no-todos',
  'contract-test-data',
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
  try { spec = JSON.parse(readFileSync(join(dir, 'test-data-policy-spec.json'), 'utf8')); }
  catch { /* gates already caught this */ }

  const project = spec.project ?? 'default';
  const strategies = Array.isArray(spec.strategy) ? spec.strategy : (spec.strategy ? [spec.strategy] : []);
  const timestamp = new Date().toISOString();
  const attestation = {
    hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
    timestamp,
  };

  const artifact = {
    ir_id: `TEST_DATA_POLICY:${project}`,
    project,
    strategies,
    isolation: spec.isolation ?? null,
    piiPolicy: spec.piiPolicy ?? null,
    seed: spec.seed ?? null,
    factoryFramework: spec.factoryFramework ?? null,
    snapshotPolicy: spec.snapshotPolicy ?? null,
    gates: results,
    pass: allPass,
    attestation,
  };

  writeFileSync(join(dir, 'test-data-policy-artifact.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}
