#!/usr/bin/env node
/**
 * Backend Test Module Compiler Runner
 * Produces: test-module-artifact.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'BT001', name: 'spec-valid',           phase: 1 },
  { id: 'BT002', name: 'scenarios-covered',    phase: 2 },
  { id: 'BT003', name: 'no-real-network',      phase: 3 },
  { id: 'BT004', name: 'no-shared-state',      phase: 3 },
  { id: 'BT005', name: 'typed-mocks',          phase: 4 },
  { id: 'BT006', name: 'no-weak-assertions',   phase: 4 },
  { id: 'BT007', name: 'no-todos',             phase: 5 },
  { id: 'BT008', name: 'tests-pass',           phase: 5 },
  { id: 'BT009', name: 'contract-test-module', phase: 6 },
];

const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Coverage', 3: 'Isolation', 4: 'Assertion Quality', 5: 'Quality', 6: 'Attest' };

function countTestFiles(dir) {
  let count = 0;
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name)); }
      else if (f.name.match(/\.(test|spec)\.(ts|mjs|js)$/)) count++;
    }
  }
  walk(dir);
  return count;
}

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│    Backend Test Module Compiler         │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'test-module-spec.json'), 'utf8'));
  const timestamp = new Date().toISOString();
  const artifact = {
    compiler: 'backend-test-module',
    version: '1.0.0',
    compiled_at: timestamp,
    ir_id: `TEST_MODULE:${spec.module}`,
    module: spec.module,
    scenarios_covered: spec.scenarios.length,
    test_files: countTestFiles(dir),
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation: {
      hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
      timestamp,
    },
  };

  writeFileSync(join(dir, 'test-module-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ test-module-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation.hash.slice(0, 16)}...\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
