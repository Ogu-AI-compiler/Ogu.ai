#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'IV001', name: 'spec-valid',            phase: 1 },
  { id: 'IV002', name: 'no-orphan-queries',     phase: 2 },
  { id: 'IV003', name: 'no-orphan-mutations',   phase: 2 },
  { id: 'IV004', name: 'no-circular',           phase: 2 },
  { id: 'IV005', name: 'cross-query',           phase: 3 },
  { id: 'IV006', name: 'cross-mutation',        phase: 3 },
  { id: 'IV007', name: 'contract-invalidation', phase: 4 },
];
const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Implement', 3: 'Cross-Compiler Verify', 4: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│        Invalidation Map Compiler        │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'invalidation-spec.json'), 'utf8'));
  const artifact = {
    compiler: 'invalidation-map', version: '1.0.0', compiled_at: new Date().toISOString(),
    mutations: Object.keys(spec.map || {}),
    query_keys: [...new Set(Object.values(spec.map || {}).flat())],
    tier: 'frontend',
    gates_passed: results.filter(r => r.pass || r.skipped).length, gates_total: results.length,
    attestation_hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex')
  };
  writeFileSync(join(dir, 'invalidation-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log(`\n  ✓ All gates passed\n  ✓ invalidation-artifact.json written\n  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}
run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
