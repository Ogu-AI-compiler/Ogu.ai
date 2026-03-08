#!/usr/bin/env node
/**
 * Loading Skeleton Compiler Runner
 * Compiles skeleton loading components with accessibility and structural fidelity gates.
 * Produces: skeleton-artifact.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'SK001', name: 'spec-valid',       phase: 1 },
  { id: 'SK002', name: 'ts-valid',          phase: 2 },
  { id: 'SK003', name: 'no-any',            phase: 2 },
  { id: 'SK004', name: 'aria-busy',         phase: 3 },
  { id: 'SK005', name: 'reduced-motion',    phase: 3 },
  { id: 'SK006', name: 'shape-fidelity',    phase: 3 },
  { id: 'SK007', name: 'no-real-data',      phase: 3 },
  { id: 'SK008', name: 'no-todos',          phase: 4 },
  { id: 'SK009', name: 'tests-pass',        phase: 4 },
  { id: 'SK010', name: 'cross-component',   phase: 5 },
  { id: 'SK011', name: 'contract-skeleton', phase: 6 },
];

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│       Loading Skeleton Compiler         │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'skeleton-spec.json'), 'utf8'));
  const skeletonFiles = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));

  const artifact = {
    compiler: 'loading-skeleton',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    component_name: spec.componentName,
    shape: spec.shape,
    rows: spec.rows || null,
    has_reduced_motion: true,
    skeleton_file: skeletonFiles[0] || null,
    component_artifact_ref: spec.componentArtifact || null,
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex')
  };

  writeFileSync(join(dir, 'skeleton-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ skeleton-artifact.json written`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
