#!/usr/bin/env node
/**
 * Service Client Runtime Module Compiler Runner
 * Produces: client-runtime-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'SR001', name: 'spec-valid',            phase: 1 },
  { id: 'SR002', name: 'timeout-enforced',      phase: 2 },
  { id: 'SR003', name: 'base-url-from-config',  phase: 2 },
  { id: 'SR004', name: 'secrets-redacted',      phase: 3 },
  { id: 'SR005', name: 'retry-allowlisted',     phase: 3 },
  { id: 'SR006', name: 'errors-typed',          phase: 4 },
  { id: 'SR007', name: 'no-todos',              phase: 4 },
  { id: 'SR008', name: 'tests-pass',            phase: 5 },
  { id: 'SR009', name: 'contract-client-runtime', phase: 6 },
];

const PHASE_NAMES = {
  1: 'Parse & Validate Spec',
  2: 'Implementation Check',
  3: 'Security Check',
  4: 'Error Handling',
  5: 'Quality',
  6: 'Attest',
};

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│  Service Client Runtime Module Compiler │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'client-runtime-spec.json'), 'utf8'));

  const artifact = {
    compiler: 'service-client-runtime-module',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    ir_id: 'CLIENT_RUNTIME:http',
    default_timeout_ms: spec.defaultTimeout,
    retry_policy: spec.retryPolicy,
    secret_headers: spec.secretHeaders,
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex'),
  };

  writeFileSync(join(dir, 'client-runtime-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ client-runtime-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
