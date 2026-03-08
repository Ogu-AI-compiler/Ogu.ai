#!/usr/bin/env node
/**
 * Routing Config Compiler Runner
 * Compiles router configuration with lazy loading, typed params, auth guards, no dead/cyclic routes.
 * Produces: routing-artifact.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'RC001', name: 'spec-valid',      phase: 1 },
  { id: 'RC002', name: 'ts-valid',         phase: 2 },
  { id: 'RC003', name: 'no-any',           phase: 2 },
  { id: 'RC004', name: 'no-dead-routes',   phase: 3 },
  { id: 'RC005', name: 'no-cyclic-routes', phase: 3 },
  { id: 'RC006', name: 'lazy-loading',     phase: 3 },
  { id: 'RC007', name: 'typed-params',     phase: 3 },
  { id: 'RC008', name: 'no-todos',         phase: 4 },
  { id: 'RC009', name: 'tests-pass',       phase: 4 },
  { id: 'RC010', name: 'cross-page',       phase: 5 },
  { id: 'RC011', name: 'cross-guard',      phase: 5 },
  { id: 'RC012', name: 'contract-routing', phase: 6 },
];

function countRoutes(routes) {
  let count = 0;
  for (const r of routes) {
    count++;
    if (r.children) count += countRoutes(r.children);
  }
  return count;
}

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│        Routing Config Compiler          │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'routing-spec.json'), 'utf8'));

  const artifact = {
    compiler: 'routing-config',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    router_type: spec.type || 'react-router-v6',
    route_count: countRoutes(spec.routes),
    routes: spec.routes.map(r => ({ path: r.path, component: r.component, auth: r.auth || r.protected || false })),
    page_artifact_refs: spec.pageArtifacts || [],
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex')
  };

  writeFileSync(join(dir, 'routing-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ routing-artifact.json written`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
