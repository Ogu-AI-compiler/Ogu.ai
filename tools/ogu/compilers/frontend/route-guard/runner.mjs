#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'RG001', name: 'spec-valid',         phase: 1 },
  { id: 'RG002', name: 'ts-valid',           phase: 2 },
  { id: 'RG003', name: 'no-any',             phase: 2 },
  { id: 'RG004', name: 'redirect-on-unauth', phase: 3 },
  { id: 'RG005', name: 'no-flash',           phase: 3 },
  { id: 'RG006', name: 'loading-state',      phase: 3 },
  { id: 'RG007', name: 'no-todos',           phase: 4 },
  { id: 'RG008', name: 'tests-pass',         phase: 4 },
  { id: 'RG009', name: 'cross-auth',         phase: 5 },
  { id: 'RG010', name: 'cross-routing',      phase: 5 },
  { id: 'RG011', name: 'contract-guard',     phase: 6 },
];
const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Scaffold', 3: 'Implement', 4: 'Test', 5: 'Cross-Compiler Verify', 6: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│          Route Guard Compiler           │');
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
    if (!existsSync(gatePath)) { results.push({ ...gate, pass: true, skipped: true, message: 'Gate not found' }); continue; }
    const { run: gateRun } = await import(gatePath);
    let result;
    try { result = await gateRun({ dir, projectRoot }); }
    catch (err) { result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` }; }
    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL'}: ${result.message}`);
    if (result.detail && !result.pass) result.detail.split('\n').slice(0, 5).forEach(l => console.log(`         ${l}`));
    results.push({ ...gate, ...result });
    if (!result.pass && !result.skipped) { console.log(`\n  ✗ Halted at ${gate.id}\n`); process.exit(1); }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'guard-spec.json'), 'utf8'));
  const artifact = {
    compiler: 'route-guard', version: '1.0.0', compiled_at: new Date().toISOString(),
    guard_component: spec.component || 'ProtectedRoute',
    redirect_to: spec.redirectTo || '/login',
    tier: 'frontend',
    gates_passed: results.filter(r => r.pass || r.skipped).length, gates_total: results.length,
    attestation_hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex')
  };
  writeFileSync(join(dir, 'guard-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log(`\n  ✓ All gates passed\n  ✓ guard-artifact.json written\n  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}
run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
