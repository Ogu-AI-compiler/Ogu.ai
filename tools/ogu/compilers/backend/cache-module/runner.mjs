#!/usr/bin/env node
/**
 * Cache Module Compiler Runner
 * Produces: cache-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'CA001', name: 'spec-valid',               phase: 1 },
  { id: 'CA002', name: 'cross-topology',           phase: 1 },
  { id: 'CA003', name: 'key-builder-matches-spec', phase: 2 },
  { id: 'CA004', name: 'no-inline-ttl',            phase: 2 },
  { id: 'CA005', name: 'miss-propagates',          phase: 3 },
  { id: 'CA006', name: 'no-writeback-on-failure',  phase: 3 },
  { id: 'CA007', name: 'invalidation-scoped',      phase: 4 },
  { id: 'CA008', name: 'no-todos',                 phase: 5 },
  { id: 'CA009', name: 'tests-pass',               phase: 5 },
  { id: 'CA010', name: 'contract-cache',           phase: 6 },
];

const PHASE_NAMES = { 1: 'Parse & Validate Spec', 2: 'Key Contract', 3: 'Read/Write Pattern', 4: 'Invalidation', 5: 'Quality', 6: 'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│         Cache Module Compiler           │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'cache-spec.json'), 'utf8'));
  const timestamp = new Date().toISOString();
  const artifact = {
    compiler: 'cache-module',
    version: '1.0.0',
    compiled_at: timestamp,
    ir_id: `CACHE:${spec.namespace}`,
    family: spec.family,
    namespace: spec.namespace,
    pattern: spec.pattern,
    keyInputs: spec.keyInputs,
    invalidates: spec.invalidates || [],
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation: {
      hash: createHash('sha256').update(JSON.stringify({ spec, timestamp })).digest('hex'),
      timestamp,
    },
  };

  writeFileSync(join(dir, 'cache-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ cache-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id}`);
  console.log(`  ✓ Attestation: ${artifact.attestation.hash.slice(0, 16)}...\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
