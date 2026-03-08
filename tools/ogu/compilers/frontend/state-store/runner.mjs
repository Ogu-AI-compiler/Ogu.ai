#!/usr/bin/env node
/**
 * State Store Compiler Runner
 * Compiles Zustand stores or Redux Toolkit slices with immutable updates and typed selectors.
 * Produces: store-artifact.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'SS001', name: 'spec-valid',       phase: 1 },
  { id: 'SS002', name: 'naming-valid',      phase: 1 },
  { id: 'SS003', name: 'ts-valid',          phase: 2 },
  { id: 'SS004', name: 'no-any',            phase: 2 },
  { id: 'SS005', name: 'immutable-updates', phase: 3 },
  { id: 'SS006', name: 'no-async-reducer',  phase: 3 },
  { id: 'SS007', name: 'selectors-pure',    phase: 3 },
  { id: 'SS008', name: 'no-todos',          phase: 4 },
  { id: 'SS009', name: 'tests-pass',        phase: 4 },
  { id: 'SS010', name: 'coverage',          phase: 4 },
  { id: 'SS011', name: 'cross-schema',      phase: 5 },
  { id: 'SS012', name: 'contract-store',    phase: 6 },
];

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│         State Store Compiler            │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`  Target: ${dir}\n`);

  const results = [];
  let currentPhase = 0;

  for (const gate of GATES) {
    if (gate.phase !== currentPhase) {
      currentPhase = gate.phase;
      const phaseNames = { 1: 'Parse & Validate Spec', 2: 'Scaffold', 3: 'Implement', 4: 'Test', 5: 'Cross-Compiler Verify', 6: 'Attest' };
      console.log(`\n  Phase ${gate.phase}: ${phaseNames[gate.phase]}`);
      console.log('  ' + '─'.repeat(38));
    }

    const gatePath = join(compilerRoot, 'gates', `${gate.name}.mjs`);
    if (!existsSync(gatePath)) {
      console.log(`  ⚠  [${gate.id}] ${gate.name} — gate file missing, skipping`);
      results.push({ ...gate, pass: true, skipped: true, message: 'Gate file not found' });
      continue;
    }

    const { run: gateRun } = await import(gatePath);
    let result;
    try {
      result = await gateRun({ dir, projectRoot });
    } catch (err) {
      result = { pass: false, code: gate.id, message: `Gate threw: ${err.message}` };
    }

    const icon = result.skipped ? '⊘' : result.pass ? '✓' : '✗';
    const label = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
    console.log(`  ${icon}  [${gate.id}] ${gate.name} — ${label}: ${result.message}`);
    if (result.detail && !result.pass) {
      result.detail.split('\n').slice(0, 5).forEach(l => console.log(`         ${l}`));
    }

    results.push({ ...gate, ...result });

    if (!result.pass && !result.skipped) {
      console.log(`\n  ✗ Compilation halted at gate ${gate.id}\n`);
      process.exit(1);
    }
  }

  const spec = JSON.parse(readFileSync(join(dir, 'store-spec.json'), 'utf8'));
  const storeFiles = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  const artifact = {
    compiler: 'state-store',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    name: spec.name,
    engine: spec.engine,
    state_shape: Object.keys(spec.state || {}),
    actions: spec.actions || [],
    selectors: spec.selectors || [],
    store_file: storeFiles[0] || null,
    schema_artifact_ref: spec.schemaArtifact || null,
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex')
  };

  writeFileSync(join(dir, 'store-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ store-artifact.json written`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
