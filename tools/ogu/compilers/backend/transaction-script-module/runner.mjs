#!/usr/bin/env node
/**
 * Transaction Script Module Compiler Runner
 * Produces: transaction-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'TX001', name: 'spec-valid',            phase: 1 },
  { id: 'TX002', name: 'writes-in-transaction', phase: 2 },
  { id: 'TX003', name: 'no-http-in-transaction',phase: 2 },
  { id: 'TX004', name: 'rollback-on-failure',   phase: 3 },
  { id: 'TX005', name: 'isolation-declared',    phase: 3 },
  { id: 'TX006', name: 'no-todos',              phase: 4 },
  { id: 'TX007', name: 'tests-pass',            phase: 4 },
  { id: 'TX008', name: 'contract-transaction',  phase: 5 },
];

const PHASE_NAMES = { 1:'Parse & Validate Spec', 2:'Atomicity Check', 3:'Safety Check', 4:'Quality', 5:'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│   Transaction Script Module Compiler    │');
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
      results.push({ ...gate, pass: true, skipped: true, message: 'Gate file not found' });
      console.log(`  ⚠  [${gate.id}] ${gate.name} — gate file missing, skipping`);
      continue;
    }
    const { run: gateRun } = await import(gatePath);
    let result;
    try { result = await gateRun({ dir, projectRoot }); }
    catch (err) { result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` }; }

    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${label}: ${result.message}`);
    if (result.detail && !result.pass) result.detail.split('\n').slice(0, 8).forEach(l => console.log(`         ${l}`));
    results.push({ ...gate, ...result });
    if (!result.pass && !result.skipped) { console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`); process.exit(1); }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'transaction-spec.json'), 'utf8'));
  const timestamp = new Date().toISOString();
  const artifact = {
    compiler: 'transaction-script-module',
    version: '1.0.0',
    compiled_at: timestamp,
    ir_id: `TRANSACTION:${spec.name}`,
    name: spec.name,
    orm: spec.orm,
    writes: (spec.writes || []).map(w => w.model || w),
    isolationLevel: spec.isolationLevel || 'default',
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation: {
      hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
      timestamp,
    },
  };

  writeFileSync(join(dir, 'transaction-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ transaction-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation.hash.slice(0, 16)}...\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
