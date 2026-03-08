import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * accessibility-policy runner
 * Executes all QA070–QA077 gates sequentially.
 * Produces: accessibility-policy-artifact.json
 */

const GATES = [
  'spec-valid',
  'wcag-standard-current',
  'fail-on-critical',
  'no-excessive-exclusions',
  'manual-checkpoints-defined',
  'disabled-rules-justified',
  'no-todos',
  'contract-accessibility',
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
  try { spec = JSON.parse(readFileSync(join(dir, 'accessibility-policy-spec.json'), 'utf8')); }
  catch { /* gates already caught this */ }

  const project = spec.project ?? 'default';
  const timestamp = new Date().toISOString();
  const attestation = {
    hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
    timestamp,
  };

  const artifact = {
    ir_id: `ACCESSIBILITY_POLICY:${project}`,
    project,
    tool: spec.tool ?? null,
    wcagVersion: spec.wcagVersion ?? null,
    wcagLevel: spec.wcagLevel ?? null,
    ciEnforcement: spec.ciEnforcement ?? null,
    manualCheckpoints: spec.manualCheckpoints ?? [],
    disabledRules: spec.disabledRules ?? [],
    excludedSelectors: spec.exclude ?? [],
    gates: results,
    pass: allPass,
    attestation,
  };

  writeFileSync(join(dir, 'accessibility-policy-artifact.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}
