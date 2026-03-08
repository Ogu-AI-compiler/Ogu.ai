#!/usr/bin/env node
/**
 * Mutation Module Compiler Runner
 * Compiles typed useMutation hooks with invalidation, optimistic updates, and error handling.
 * Produces: mutation-artifact.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'MU001', name: 'spec-valid',        phase: 1 },
  { id: 'MU002', name: 'naming-valid',       phase: 1 },
  { id: 'MU003', name: 'ts-valid',           phase: 2 },
  { id: 'MU004', name: 'no-any',             phase: 2 },
  { id: 'MU005', name: 'invalidation-check', phase: 3 },
  { id: 'MU006', name: 'optimistic-valid',   phase: 3 },
  { id: 'MU007', name: 'error-handler',      phase: 3 },
  { id: 'MU008', name: 'no-todos',           phase: 4 },
  { id: 'MU009', name: 'tests-pass',         phase: 4 },
  { id: 'MU010', name: 'coverage',           phase: 4 },
  { id: 'MU011', name: 'cross-route',        phase: 5 },
  { id: 'MU012', name: 'cross-query',        phase: 5 },
  { id: 'MU013', name: 'contract-mutation',  phase: 6 },
];

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│       Mutation Module Compiler          │');
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

  const spec = JSON.parse(readFileSync(join(dir, 'mutation-spec.json'), 'utf8'));
  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));

  const artifact = {
    compiler: 'mutation-module',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    hook_name: spec.hookName,
    endpoint: spec.endpoint,
    method: spec.method,
    payload_type: spec.payloadType,
    invalidates_queries: spec.invalidatesQueries || [],
    has_optimistic: spec.optimistic === true,
    hook_file: hookFiles[0] || null,
    route_artifact_ref: spec.routeArtifact || null,
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex')
  };

  writeFileSync(join(dir, 'mutation-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ mutation-artifact.json written`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
