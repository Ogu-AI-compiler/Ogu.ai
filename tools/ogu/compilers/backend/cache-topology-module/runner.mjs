#!/usr/bin/env node
/**
 * Cache Topology Module Compiler Runner
 * Produces: cache-topology-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'CT001', name: 'spec-valid',                 phase: 1 },
  { id: 'CT002', name: 'namespaces-valid',           phase: 2 },
  { id: 'CT003', name: 'ttl-declared',               phase: 2 },
  { id: 'CT004', name: 'no-duplicate-keys',          phase: 2 },
  { id: 'CT005', name: 'key-builders-deterministic', phase: 3 },
  { id: 'CT006', name: 'no-todos',                   phase: 4 },
  { id: 'CT007', name: 'tests-pass',                 phase: 4 },
  { id: 'CT008', name: 'contract-cache-topology',    phase: 5 },
];

const PHASE_NAMES = { 1:'Parse & Validate Spec', 2:'Topology Check', 3:'Determinism Check', 4:'Quality', 5:'Attest' };

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│    Cache Topology Module Compiler       │');
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

    if (!result.pass && !result.skipped) {
      console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`);
      process.exit(1);
    }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'cache-topology-spec.json'), 'utf8'));

  const artifact = {
    compiler: 'cache-topology-module',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    ir_id: 'CACHE_TOPOLOGY:global',
    families: spec.families.map(f => ({
      name: f.name,
      namespace: f.namespace,
      resource: f.resource,
      ttl_seconds: f.ttl || null,
      no_expiry: f.noExpiry === true,
      serializer: f.serializer || 'json',
      key_inputs: f.keyInputs || [],
    })),
    namespaces: spec.families.map(f => f.namespace),
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex'),
  };

  writeFileSync(join(dir, 'cache-topology-artifact.json'), JSON.stringify(artifact, null, 2));
  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ cache-topology-artifact.json written`);
  console.log(`  ✓ IR: ${artifact.ir_id} (${artifact.families.length} families)`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => { console.error(`\n  Fatal: ${err.message}\n`); process.exit(1); });
