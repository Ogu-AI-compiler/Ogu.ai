#!/usr/bin/env node
/**
 * Domain Service Module Compiler Runner
 * Produces: service-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'DS001', name: 'spec-valid',           phase: 1 },
  { id: 'DS002', name: 'ts-valid',             phase: 2 },
  { id: 'DS003', name: 'no-any',               phase: 2 },
  { id: 'DS004', name: 'no-http-imports',      phase: 3 },
  { id: 'DS005', name: 'no-env-access',        phase: 3 },
  { id: 'DS006', name: 'no-inline-multiwrite', phase: 3 },
  { id: 'DS007', name: 'typed-results',        phase: 4 },
  { id: 'DS008', name: 'idempotency-strategy', phase: 4 },
  { id: 'DS009', name: 'no-todos',             phase: 5 },
  { id: 'DS010', name: 'tests-pass',           phase: 5 },
  { id: 'DS011', name: 'contract-service',     phase: 6 },
];

const PHASE_NAMES = { 1:'Parse & Validate Spec', 2:'Type Check', 3:'Boundary Check', 4:'Contract Check', 5:'Quality', 6:'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│     Domain Service Module Compiler      │');
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
    if (!existsSync(gatePath)) { results.push({ ...gate, pass:true, skipped:true, message:'Gate file not found' }); console.log(`  ⚠  [${gate.id}] ${gate.name} — gate file missing, skipping`); continue; }
    const { run: gateRun } = await import(gatePath);
    let result;
    try { result = await gateRun({ dir, projectRoot }); }
    catch (err) { result = { pass:false, code:gate.id, message:`Gate threw: ${err.message}` }; }
    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${label}: ${result.message}`);
    if (result.detail && !result.pass) result.detail.split('\n').slice(0,8).forEach(l => console.log(`         ${l}`));
    results.push({ ...gate, ...result });
    if (!result.pass && !result.skipped) { console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`); process.exit(1); }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'service-spec.json'), 'utf8'));
  const artifact = {
    compiler: 'domain-service-module',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    ir_id: `SERVICE:${spec.name}`,
    service_name: spec.name,
    use_cases: spec.useCases.map(uc => ({ name: uc.name, idempotent: uc.idempotent || false, multi_write: uc.multiWrite || false })),
    dependencies: spec.dependencies.map(d => ({ name: d.name, type: d.type })),
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex'),
  };

  writeFileSync(join(dir, 'service-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ service-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0,16)}...\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
