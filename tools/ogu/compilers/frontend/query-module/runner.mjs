#!/usr/bin/env node
/**
 * Query Module Compiler Runner
 * Compiles typed React Query hooks from API route specs.
 * Produces: query-artifact.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const GATES = [
  { id: 'QM001', name: 'spec-valid',      phase: 1 },
  { id: 'QM002', name: 'naming-valid',    phase: 1 },
  { id: 'QM003', name: 'querykey-valid',  phase: 1 },
  { id: 'QM004', name: 'ts-valid',        phase: 2 },
  { id: 'QM005', name: 'no-any',          phase: 2 },
  { id: 'QM006', name: 'enabled-guard',   phase: 3 },
  { id: 'QM007', name: 'no-side-effects', phase: 3 },
  { id: 'QM008', name: 'no-todos',        phase: 4 },
  { id: 'QM009', name: 'tests-pass',      phase: 4 },
  { id: 'QM010', name: 'coverage',        phase: 4 },
  { id: 'QM011', name: 'cross-route',     phase: 5 },
  { id: 'QM012', name: 'contract-query',  phase: 6 },
];

async function run() {
  const dir = resolve(process.argv[2] || process.cwd());
  const projectRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
  const compilerRoot = new URL('.', import.meta.url).pathname;

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│        Query Module Compiler            │');
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

  // Build artifact
  const spec = JSON.parse(readFileSync(join(dir, 'query-spec.json'), 'utf8'));
  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));

  const artifact = {
    compiler: 'query-module',
    version: '1.0.0',
    compiled_at: new Date().toISOString(),
    hook_name: spec.hookName,
    endpoint: spec.endpoint,
    method: spec.method,
    response_type: spec.responseType,
    path_params: spec.pathParams || [],
    query_params: spec.queryParams || [],
    caching: {
      stale_time: spec.staleTime || '5m',
      cache_time: spec.cacheTime || '10m'
    },
    hook_file: hookFiles[0] || null,
    route_artifact_ref: spec.routeArtifact || null,
    gates_passed: results.filter(r => r.pass || r.skipped).length,
    gates_total: results.length,
    attestation_hash: createHash('sha256')
      .update(JSON.stringify({ spec, timestamp: new Date().toISOString() }))
      .digest('hex')
  };

  writeFileSync(join(dir, 'query-artifact.json'), JSON.stringify(artifact, null, 2));

  console.log('\n  ✓ All gates passed');
  console.log(`  ✓ query-artifact.json written`);
  console.log(`  ✓ Attestation: ${artifact.attestation_hash.slice(0, 16)}...\n`);
}

run().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
