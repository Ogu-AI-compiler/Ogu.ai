#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'FF001', name: 'spec-valid',        phase: 1 },
  { id: 'FF002', name: 'ts-valid',          phase: 2 },
  { id: 'FF003', name: 'no-any',            phase: 2 },
  { id: 'FF004', name: 'safe-defaults',     phase: 3 },
  { id: 'FF005', name: 'naming-convention', phase: 3 },
  { id: 'FF006', name: 'no-nested-flags',   phase: 3 },
  { id: 'FF007', name: 'no-todos',          phase: 4 },
  { id: 'FF008', name: 'tests-pass',        phase: 4 },
  { id: 'FF009', name: 'contract-flag',     phase: 5 },
];
const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Scaffold', 3: 'Implement', 4: 'Test', 5: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│         Feature Flag Compiler           │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'flag-spec.json'), 'utf8'));
  const artifact = {
    compiler: 'feature-flag', version: '1.0.0', compiled_at: new Date().toISOString(),
    flags: (spec.flags || []).map(f => ({ name: f.name, defaultValue: f.defaultValue })),
    flag_count: (spec.flags || []).length,
    tier: 'shared',
    gates_passed: results.filter(r => r.pass || r.skipped).length, gates_total: results.length,
    attestation_hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex')
  };
  writeFileSync(join(dir, 'flag-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log(`\n  ✓ All gates passed\n  ✓ flag-artifact.json written\n  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}
run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
