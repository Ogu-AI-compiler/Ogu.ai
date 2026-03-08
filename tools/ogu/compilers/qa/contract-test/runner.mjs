import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * contract-test runner
 * Executes all QA050–QA057 gates sequentially.
 * Produces: contract-test-artifact.json
 */

const GATES = [
  'spec-valid',
  'broker-url-from-env',
  'publish-results-true',
  'interactions-match-openapi',
  'no-wildcard-matching',
  'openapi-validation-enabled',
  'no-todos',
  'contract-pact',
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
  try { spec = JSON.parse(readFileSync(join(dir, 'contract-test-spec.json'), 'utf8')); }
  catch { /* gates already caught this */ }

  const consumer = spec.consumer ?? 'unknown';
  const timestamp = new Date().toISOString();
  const attestation = {
    hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
    timestamp,
  };

  const artifact = {
    ir_id: `CONTRACT_TEST:${consumer}`,
    framework: spec.framework ?? null,
    consumer,
    providers: spec.providers ?? [],
    interactions: spec.interactions ?? [],
    broker: spec.broker ? { url: spec.broker.url ?? null } : null,
    publishResults: spec.publishResults ?? false,
    openApiSpec: spec.openApiSpec ?? null,
    gates: results,
    pass: allPass,
    attestation,
  };

  writeFileSync(join(dir, 'contract-test-artifact.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}
