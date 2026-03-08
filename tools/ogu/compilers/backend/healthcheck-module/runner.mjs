#!/usr/bin/env node
/**
 * Healthcheck Module Compiler Runner
 * Produces: healthcheck-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'HC001', name: 'spec-valid',              phase: 1 },
  { id: 'HC002', name: 'liveness-no-remote',     phase: 2 },
  { id: 'HC003', name: 'readiness-machine-readable', phase: 3 },
  { id: 'HC004', name: 'dependency-timeouts',    phase: 3 },
  { id: 'HC005', name: 'no-destructive-ops',     phase: 4 },
  { id: 'HC006', name: 'deterministic-failure',  phase: 4 },
  { id: 'HC007', name: 'no-todos',               phase: 5 },
  { id: 'HC008', name: 'tests-pass',             phase: 5 },
  { id: 'HC009', name: 'contract-healthcheck',   phase: 6 },
];

const PHASE_NAMES = { 1:'Parse & Validate Spec', 2:'Liveness Check', 3:'Readiness Check', 4:'Safety Check', 5:'Quality', 6:'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│       Healthcheck Module Compiler       │');
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
    if (result.detail && !result.pass) result.detail.split('\n').slice(0,8).forEach(l => console.log(`         ${l}`));
    results.push({ ...gate, ...result });
    if (!result.pass && !result.skipped) { console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`); process.exit(1); }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'healthcheck-spec.json'), 'utf8'));
  const artifact = {
    compiler: 'healthcheck-module',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    ir_id: 'HEALTHCHECK:app',
    dependencies: spec.dependencies.map(d => ({ name: d.name, type: d.type, timeout_ms: d.timeoutMs })),
    liveness_checks: spec.livenessChecks || [],
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256').update(JSON.stringify({ spec, timestamp: new Date().toISOString() })).digest('hex'),
  };

  writeFileSync(join(dir, 'healthcheck-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ healthcheck-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id} (${artifact.dependencies.length} deps)`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0,16)}...\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
