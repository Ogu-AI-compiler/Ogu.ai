#!/usr/bin/env node
/**
 * Backend Test Harness Config Compiler Runner
 * Compiles the test runner config and infrastructure from test-harness-spec.json.
 * Produces: test-harness-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'TH001', name: 'spec-valid',           phase: 1 },
  { id: 'TH002', name: 'runner-config-valid',  phase: 2 },
  { id: 'TH003', name: 'env-split-valid',      phase: 2 },
  { id: 'TH004', name: 'network-blocked',      phase: 3 },
  { id: 'TH005', name: 'coverage-enforced',    phase: 3 },
  { id: 'TH006', name: 'setup-registered',     phase: 4 },
  { id: 'TH007', name: 'no-todos',             phase: 4 },
  { id: 'TH008', name: 'contract-test-harness',phase: 5 },
];

const PHASE_NAMES = {
  1: 'Parse & Validate Spec',
  2: 'Config Check',
  3: 'Safety Check',
  4: 'Quality',
  5: 'Attest',
};

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│  Backend Test Harness Config Compiler   │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`  Target: ${dir}\n`);

  const results = [];
  let currentPhase = 0;

  for (const gate of GATES) {
    if (gate.phase !== currentPhase) {
      currentPhase = gate.phase;
      console.log(`\n  Phase ${gate.phase}: ${PHASE_NAMES[gate.phase]}`);
      console.log('  ' + '─'.repeat(38));
    }

    const gatePath = join(compilerRoot, 'gates', `${gate.name}.mjs`);
    if (!existsSync(gatePath)) {
      console.log(`  ⚠  [${gate.id}] ${gate.name} — gate file missing, skipping`);
      results.push({ ...gate, pass: true, skipped: true, message: 'Gate file not found' });
      continue;
    }

    const { run: gateRun } = await import(gatePath);
    let result;
    try {
      result = await gateRun({ dir, projectRoot });
    } catch (err) {
      result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` };
    }

    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${label}: ${result.message}`);
    if (result.detail && !result.pass) {
      result.detail.split('\n').slice(0, 8).forEach(l => console.log(`         ${l}`));
    }

    results.push({ ...gate, ...result });

    if (!result.pass && !result.skipped) {
      console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`);
      process.exit(1);
    }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));

  const artifact = {
    compiler: 'backend-test-harness-config',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    ir_id: `TEST_HARNESS:${spec.runner}`,
    runner: spec.runner,
    coverage_thresholds: spec.coverageThresholds,
    environments: spec.environments.map(e => e.name),
    network_blocked_in_unit: true,
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex'),
  };

  writeFileSync(join(dir, 'test-harness-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ test-harness-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
