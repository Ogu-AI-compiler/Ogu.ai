#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'RL001', name: 'spec-valid',                 phase: 1 },
  { id: 'RL002', name: 'key-deterministic',          phase: 2 },
  { id: 'RL003', name: 'retry-after-header',         phase: 2 },
  { id: 'RL004', name: 'no-undeclared-bypass',       phase: 3 },
  { id: 'RL005', name: 'no-todos',                   phase: 4 },
  { id: 'RL006', name: 'tests-pass',                 phase: 4 },
  { id: 'RL007', name: 'contract-rate-limit-policy', phase: 5 },
];
const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Policy Contract', 3: 'Bypass Safety', 4: 'Quality', 5: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│   Rate Limit Policy Module Compiler     │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`  Target: ${dir}\n`);
  const results = [];
  let currentPhase = 0;
  for (const gate of GATES) {
    if (gate.phase !== currentPhase) { currentPhase = gate.phase; console.log(`\n  Phase ${gate.phase}: ${PHASE_NAMES[gate.phase]}`); console.log('  '+'─'.repeat(38)); }
    const gatePath = join(compilerRoot, 'gates', `${gate.name}.mjs`);
    if (!existsSync(gatePath)) { results.push({ ...gate, pass: true, skipped: true }); console.log(`  ⚠  [${gate.id}] skipped`); continue; }
    const { run: gateRun } = await import(gatePath);
    let result;
    try { result = await gateRun({ dir, projectRoot }); } catch (err) { result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` }; }
    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${result.skipped?'SKIP':result.pass?'PASS':'FAIL'}: ${result.message}`);
    if (result.detail && !result.pass) result.detail.split('\n').slice(0,8).forEach(l => console.log(`         ${l}`));
    results.push({ ...gate, ...result });
    if (!result.pass && !result.skipped) { console.log(`\n  ✗ Halted at ${gate.id}\n`); process.exit(1); }
  }
  const spec = JSON.parse(readFileSync(join(dir, 'rate-limit-spec.json'), 'utf8'));
  const timestamp = new Date().toISOString();
  const artifact = {
    compiler: 'rate-limit-policy-module', version: '1.0.0', compiled_at: timestamp,
    ir_id: `RATE_LIMIT_POLICY:${spec.policyId}`,
    policyId: spec.policyId, scope: spec.scope, quota: spec.quota,
    windowSeconds: spec.windowSeconds, strategy: spec.strategy,
    bypassConditions: spec.bypassConditions || [],
    gates_passed: results.filter(r => r.pass || r.skipped).length, gates_total: results.length,
    attestation: { hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'), timestamp },
  };
  writeFileSync(join(dir, 'rate-limit-policy-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log(`\n  ✓ rate-limit-policy-artifact.json written — IR: ${artifact.ir_id}\n`);
}
run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
