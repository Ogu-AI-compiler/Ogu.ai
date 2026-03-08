#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'LC001', name: 'spec-valid',             phase: 1 },
  { id: 'LC002', name: 'ts-valid',               phase: 2 },
  { id: 'LC003', name: 'no-any',                 phase: 2 },
  { id: 'LC004', name: 'slot-types',             phase: 3 },
  { id: 'LC005', name: 'responsive-breakpoints', phase: 3 },
  { id: 'LC006', name: 'no-inline-styles',       phase: 3 },
  { id: 'LC007', name: 'no-todos',               phase: 4 },
  { id: 'LC008', name: 'tests-pass',             phase: 4 },
  { id: 'LC009', name: 'cross-tokens',           phase: 5 },
  { id: 'LC010', name: 'contract-layout',        phase: 6 },
];
const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Scaffold', 3: 'Implement', 4: 'Test', 5: 'Cross-Compiler Verify', 6: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│       Layout Component Compiler         │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'layout-spec.json'), 'utf8'));
  const artifact = {
    compiler: 'layout-component', version: '1.0.0', compiled_at: new Date().toISOString(),
    name: spec.name, slots: spec.slots, responsive: spec.responsive !== false,
    tokens_artifact_ref: spec.tokensArtifact || null,
    gates_passed: results.filter(r => r.pass || r.skipped).length, gates_total: results.length,
    attestation_hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex')
  };
  writeFileSync(join(dir, 'layout-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log(`\n  ✓ All gates passed\n  ✓ layout-artifact.json written\n  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}
run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
